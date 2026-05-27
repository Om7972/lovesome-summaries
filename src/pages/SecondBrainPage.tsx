import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Brain, Search, MessageSquare, Lightbulb, Loader2, Send, Sparkles, RefreshCw, Download, History as HistoryIcon, Trash2, FileText, Share2, FileSpreadsheet, GitCompare, Volume2, Play, Pause, Link2, Check, X, Settings2, Clock, Plus, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { downloadTextAsPDF } from "@/lib/export-utils";
import ReactMarkdown from "react-markdown";
import { diffLines } from "@/lib/diff-lines";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { id: string; title: string; type: string; date: string }[];
}

interface Summary {
  id: string;
  original_source: string;
  summary_text: string;
  type: string;
  created_at: string;
  tldr: string | null;
  key_points: any;
}

interface InsightHistoryItem {
  id: string;
  content: string;
  tone: string;
  length: string;
  theme_count: number;
  document_count: number;
  created_at: string;
  share_token?: string | null;
  expires_at?: string | null;
  password_hash?: string | null;
  source_ids?: any;
}

const TONES = [
  { value: "balanced", label: "Balanced" },
  { value: "analytical", label: "Analytical" },
  { value: "casual", label: "Casual" },
  { value: "motivational", label: "Motivational" },
  { value: "academic", label: "Academic" },
];
const LENGTHS = [
  { value: "short", label: "Short (concise)" },
  { value: "medium", label: "Medium (balanced)" },
  { value: "long", label: "Long (deep dive)" },
];

export default function SecondBrainPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Summary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Insights state
  const [insights, setInsights] = useState<string>("");
  const [insightSources, setInsightSources] = useState<{ id: string; title: string; type: string; date: string }[]>([]);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [tone, setTone] = useState("balanced");
  const [length, setLength] = useState("medium");
  const [themeCount, setThemeCount] = useState(5);
  const [history, setHistory] = useState<InsightHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState(false);

  // Audio
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Follow-up Q&A
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUps, setFollowUps] = useState<ChatMessage[]>([]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareExpiresIn, setShareExpiresIn] = useState<string>("never"); // never | 1h | 24h | 7d | 30d | custom
  const [shareCustomExpires, setShareCustomExpires] = useState<string>("");
  const [sharePassword, setSharePassword] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [shareCopied, setShareCopied] = useState(false);
  const [isSavingShare, setIsSavingShare] = useState(false);

  const insightsPdfRef = useRef<HTMLDivElement>(null);

  // Per-history-item share management UI
  const [openShareItemId, setOpenShareItemId] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  // Per-item async action state: { [itemId]: 'copy' | 'extend' | 'revoke' | 'never' }
  const [itemPendingAction, setItemPendingAction] = useState<Record<string, string | null>>({});
  // Audit log: events per history item
  type ShareEvent = { id: string; event_type: string; metadata: any; created_at: string };
  const [itemEvents, setItemEvents] = useState<Record<string, ShareEvent[]>>({});
  // Audit log: per-item filters, pagination, totals
  type AuditFilter = { type: string; from: string; to: string; search: string };
  const [itemFilters, setItemFilters] = useState<Record<string, AuditFilter>>({});
  const [itemPageSize, setItemPageSize] = useState<Record<string, number>>({});
  const [itemHasMore, setItemHasMore] = useState<Record<string, boolean>>({});
  const [itemTotalEvents, setItemTotalEvents] = useState<Record<string, number>>({});
  const [itemLoadingEvents, setItemLoadingEvents] = useState<Record<string, boolean>>({});
  const [csvConfirmOpen, setCsvConfirmOpen] = useState(false);
  const [csvTargetItem, setCsvTargetItem] = useState<any>(null);
  const AUDIT_PAGE_STEP = 20;
  const getAuditFilter = (id: string): AuditFilter =>
    itemFilters[id] || { type: "all", from: "", to: "", search: "" };

  const setItemPending = (id: string, action: string | null) =>
    setItemPendingAction(prev => ({ ...prev, [id]: action }));

  const logShareEvent = async (insightsHistoryId: string, eventType: string, metadata: Record<string, any> = {}) => {
    if (!user) return;
    const { data } = await supabase
      .from("insight_share_events" as any)
      .insert({ insights_history_id: insightsHistoryId, user_id: user.id, event_type: eventType, metadata })
      .select()
      .single();
    if (data) {
      setItemEvents(prev => ({
        ...prev,
        [insightsHistoryId]: [data as any, ...(prev[insightsHistoryId] || [])],
      }));
      setItemTotalEvents(prev => ({
        ...prev,
        [insightsHistoryId]: (prev[insightsHistoryId] || 0) + 1,
      }));
    }
  };

  const buildEventsQuery = (insightsHistoryId: string, filter: AuditFilter) => {
    let q = supabase
      .from("insight_share_events" as any)
      .select("id, event_type, metadata, created_at", { count: "exact" })
      .eq("insights_history_id", insightsHistoryId);
    if (filter.type && filter.type !== "all") q = q.eq("event_type", filter.type);
    if (filter.from) q = q.gte("created_at", new Date(filter.from).toISOString());
    if (filter.to) q = q.lte("created_at", new Date(filter.to).toISOString());
    if (filter.search?.trim()) {
      const term = `%${filter.search.trim()}%`;
      q = q.or(`event_type.ilike.${term},metadata::text.ilike.${term}`);
    }
    return q.order("created_at", { ascending: false });
  };

  const loadShareEvents = async (
    insightsHistoryId: string,
    opts?: { pageSize?: number; filter?: AuditFilter }
  ) => {
    if (!user) return;
    const filter = opts?.filter || getAuditFilter(insightsHistoryId);
    const pageSize = opts?.pageSize ?? itemPageSize[insightsHistoryId] ?? AUDIT_PAGE_STEP;
    setItemLoadingEvents(prev => ({ ...prev, [insightsHistoryId]: true }));
    const { data, count } = await buildEventsQuery(insightsHistoryId, filter).range(0, pageSize - 1);
    setItemEvents(prev => ({ ...prev, [insightsHistoryId]: (data as any) || [] }));
    setItemPageSize(prev => ({ ...prev, [insightsHistoryId]: pageSize }));
    setItemTotalEvents(prev => ({ ...prev, [insightsHistoryId]: count ?? (data?.length ?? 0) }));
    setItemHasMore(prev => ({
      ...prev,
      [insightsHistoryId]: (count ?? 0) > (data?.length ?? 0),
    }));
    setItemLoadingEvents(prev => ({ ...prev, [insightsHistoryId]: false }));
  };

  const updateAuditFilter = (id: string, patch: Partial<AuditFilter>) => {
    const next = { ...getAuditFilter(id), ...patch };
    setItemFilters(prev => ({ ...prev, [id]: next }));
    loadShareEvents(id, { pageSize: AUDIT_PAGE_STEP, filter: next });
  };

  const loadMoreEvents = (id: string) => {
    const next = (itemPageSize[id] ?? AUDIT_PAGE_STEP) + AUDIT_PAGE_STEP;
    loadShareEvents(id, { pageSize: next });
  };

  const exportAuditCsv = async (item: any) => {
    if (!user) return;
    const filter = getAuditFilter(item.id);
    const { data } = await buildEventsQuery(item.id, filter).range(0, 9999);
    const rows = (data as any[]) || [];
    const escape = (v: any) => {
      const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = ["created_at", "event_type", "metadata"];
    const csv = [header.join(",")]
      .concat(rows.map(r => [r.created_at, r.event_type, r.metadata].map(escape).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `share-audit-${item.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Audit log exported", description: `${rows.length} event(s) saved as CSV` });
  };

  const handleConfirmExportCsv = async () => {
    if (!csvTargetItem) return;
    setCsvConfirmOpen(false);
    await exportAuditCsv(csvTargetItem);
    setCsvTargetItem(null);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("summaries")
        .select("id, original_source, summary_text, type, created_at, tldr, key_points")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setSummaries(data);
    })();
    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("insights_history" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setHistory(data as any);
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !user) return;
    setIsSearching(true);
    try {
      const q = searchQuery.toLowerCase();
      const results = summaries.filter(s =>
        s.original_source.toLowerCase().includes(q) ||
        s.summary_text.toLowerCase().includes(q) ||
        (s.tldr && s.tldr.toLowerCase().includes(q))
      );
      setSearchResults(results);
      if (results.length === 0) toast({ title: "No results", description: "Try a different search term" });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, summaries, user, toast]);

  const handleChat = async () => {
    if (!chatInput.trim() || !user) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-knowledge", {
        body: { question: chatInput, userId: user.id },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      setChatMessages(prev => [...prev, { role: "assistant", content: data.answer, sources: data.sources }]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to get answer", variant: "destructive" });
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const buildInsightsPrompt = () => {
    const lengthInstr = length === "short" ? "Keep it concise — 2-3 short bullets per section."
      : length === "long" ? "Provide a deep, detailed analysis with rich examples and reasoning."
      : "Use a balanced level of detail.";
    const toneInstr = `Use a ${tone} tone.`;
    return `Analyze ALL my documents collectively. Identify:
(1) the top ${themeCount} recurring themes,
(2) surprising connections or patterns between different documents,
(3) ${themeCount} knowledge gaps I should explore next,
(4) one actionable insight I can apply today.

${toneInstr} ${lengthInstr}
Format as clean markdown with clear section headings (## Themes, ## Connections, ## Knowledge Gaps, ## Action).
When referencing a document, wrap its title in **bold** so I can identify it.`;
  };

  const handleGenerateInsights = async () => {
    if (!user || summaries.length === 0) return;
    setIsInsightsLoading(true);
    setFollowUps([]);
    setAudioUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("search-knowledge", {
        body: { question: buildInsightsPrompt(), userId: user.id },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      setInsights(data.answer);
      setInsightSources(data.sources || []);

      // Persist to history
      const { data: saved } = await supabase
        .from("insights_history" as any)
        .insert({
          user_id: user.id,
          content: data.answer,
          tone, length, theme_count: themeCount,
          document_count: summaries.length,
          source_ids: data.sources || [],
        })
        .select()
        .single();
      if (saved) {
        setHistory(prev => [saved as any, ...prev]);
        setActiveHistoryId((saved as any).id);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate insights", variant: "destructive" });
    } finally {
      setIsInsightsLoading(false);
    }
  };

  const handleFollowUp = async () => {
    if (!followUpInput.trim() || !user || !insights) return;
    const q = followUpInput;
    setFollowUps(prev => [...prev, { role: "user", content: q }]);
    setFollowUpInput("");
    setIsFollowUpLoading(true);
    try {
      const contextual = `Based on this previously generated insight report:\n\n"""${insights}"""\n\nFollow-up question: ${q}`;
      const { data, error } = await supabase.functions.invoke("search-knowledge", {
        body: { question: contextual, userId: user.id },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      setFollowUps(prev => [...prev, { role: "assistant", content: data.answer, sources: data.sources }]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed", variant: "destructive" });
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!insights) return;
    const sourcesHtml = insightSources.length
      ? `<ul>${insightSources.map(s => `<li>${escapeHtml(s.title)} <span class="badge">${s.type}</span></li>`).join("")}</ul>`
      : "<p><em>No source citations.</em></p>";
    const followUpsHtml = followUps.length
      ? followUps.map(f => `<p><strong>${f.role === "user" ? "Q" : "A"}:</strong> ${escapeHtml(f.content)}</p>`).join("")
      : "";
    downloadTextAsPDF(
      "AI Second Brain — Insights Report",
      [
        { heading: "Configuration", content: `<p>Tone: <strong>${tone}</strong> · Length: <strong>${length}</strong> · Themes: <strong>${themeCount}</strong> · Documents analyzed: <strong>${summaries.length}</strong></p>` },
        { heading: "Insights", content: markdownToHtml(insights) },
        { heading: "Source Documents", content: sourcesHtml },
        ...(followUpsHtml ? [{ heading: "Follow-up Q&A", content: followUpsHtml }] : []),
      ],
      `ai-insights-${new Date().toISOString().slice(0, 10)}`
    );
  };

  const loadHistoryItem = (item: InsightHistoryItem) => {
    setInsights(item.content);
    setTone(item.tone);
    setLength(item.length);
    setThemeCount(item.theme_count);
    setFollowUps([]);
    setInsightSources(Array.isArray(item.source_ids) ? item.source_ids : []);
    setActiveHistoryId(item.id);
    setAudioUrl(null);
    toast({ title: "Loaded", description: `Insights from ${new Date(item.created_at).toLocaleString()}` });
  };

  const deleteHistoryItem = async (id: string) => {
    await supabase.from("insights_history" as any).delete().eq("id", id);
    setHistory(prev => prev.filter(h => h.id !== id));
    setCompareIds(prev => prev.filter(x => x !== id));
    if (activeHistoryId === id) setActiveHistoryId(null);
  };

  // === SHARE LINK ===
  const openShareDialog = () => {
    if (!activeHistoryId) {
      toast({ title: "Save first", description: "Generate insights before sharing." });
      return;
    }
    const current = history.find(h => h.id === activeHistoryId);
    setSharePassword("");
    setShareExpiresIn("never");
    setShareCustomExpires("");
    setShareCopied(false);
    setShareUrl(current?.share_token ? `${window.location.origin}/insights/shared/${current.share_token}` : "");
    setShareDialogOpen(true);
  };

  const computeExpiresAt = (): string | null => {
    if (shareExpiresIn === "never") return null;
    if (shareExpiresIn === "custom") {
      if (!shareCustomExpires) return null;
      const d = new Date(shareCustomExpires);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const now = Date.now();
    const map: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const ms = map[shareExpiresIn];
    return ms ? new Date(now + ms).toISOString() : null;
  };

  const hashPassword = async (pwd: string): Promise<string> => {
    const data = new TextEncoder().encode(pwd);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleCreateShare = async () => {
    if (!activeHistoryId) return;
    setIsSavingShare(true);
    try {
      const current = history.find(h => h.id === activeHistoryId);
      const isNewToken = !current?.share_token;
      const token = current?.share_token
        ?? (crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")).slice(0, 40);
      const expires_at = computeExpiresAt();
      const password_hash = sharePassword.trim() ? await hashPassword(sharePassword.trim()) : null;
      const { error } = await supabase
        .from("insights_history" as any)
        .update({ share_token: token, expires_at, password_hash })
        .eq("id", activeHistoryId);
      if (error) throw error;
      setHistory(prev => prev.map(h => h.id === activeHistoryId
        ? { ...h, share_token: token, expires_at, password_hash } : h));
      const url = `${window.location.origin}/insights/shared/${token}`;
      setShareUrl(url);
      await logShareEvent(activeHistoryId, isNewToken ? "create" : "update", {
        expires_at, has_password: !!password_hash,
      });
      toast({ title: "🔗 Share link ready", description: password_hash ? "Password-protected link created." : "Anyone with the link can view." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create share link", variant: "destructive" });
    } finally {
      setIsSavingShare(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      toast({ title: "Copied!", description: "Link copied to clipboard." });
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: shareUrl, variant: "destructive" });
    }
  };

  const handleRevokeShare = async () => {
    if (!activeHistoryId) return;
    await supabase.from("insights_history" as any)
      .update({ share_token: null, expires_at: null, password_hash: null })
      .eq("id", activeHistoryId);
    setHistory(prev => prev.map(h => h.id === activeHistoryId
      ? { ...h, share_token: null, expires_at: null, password_hash: null } : h));
    setShareUrl("");
    await logShareEvent(activeHistoryId, "revoke", {});
    toast({ title: "Revoked", description: "Share link disabled." });
  };

  // === Per-item (history) share management ===
  const copyItemLink = async (item: InsightHistoryItem) => {
    if (!item.share_token) return;
    const url = `${window.location.origin}/insights/shared/${item.share_token}`;
    setItemPending(item.id, "copy");
    try {
      await navigator.clipboard.writeText(url);
      setCopiedItemId(item.id);
      await logShareEvent(item.id, "copy", {});
      toast({ title: "Copied!", description: "Share link copied to clipboard." });
      setTimeout(() => setCopiedItemId(prev => (prev === item.id ? null : prev)), 2000);
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    } finally {
      setItemPending(item.id, null);
    }
  };

  const extendItemExpiration = async (item: InsightHistoryItem, addMs: number) => {
    if (!item.share_token) return;
    setItemPending(item.id, "extend");
    const base = item.expires_at && new Date(item.expires_at).getTime() > Date.now()
      ? new Date(item.expires_at).getTime()
      : Date.now();
    const next = new Date(base + addMs).toISOString();
    const { error } = await supabase.from("insights_history" as any)
      .update({ expires_at: next }).eq("id", item.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setItemPending(item.id, null);
      return;
    }
    setHistory(prev => prev.map(h => h.id === item.id ? { ...h, expires_at: next } : h));
    await logShareEvent(item.id, "extend", { added_ms: addMs, new_expires_at: next });
    toast({ title: "Extended", description: `New expiry: ${new Date(next).toLocaleString()}` });
    setItemPending(item.id, null);
  };

  const setItemNeverExpires = async (item: InsightHistoryItem) => {
    if (!item.share_token) return;
    setItemPending(item.id, "never");
    const { error } = await supabase.from("insights_history" as any)
      .update({ expires_at: null }).eq("id", item.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setItemPending(item.id, null);
      return;
    }
    setHistory(prev => prev.map(h => h.id === item.id ? { ...h, expires_at: null } : h));
    await logShareEvent(item.id, "extend", { added_ms: null, new_expires_at: null });
    toast({ title: "Updated", description: "Link no longer expires." });
    setItemPending(item.id, null);
  };

  const revokeItemShare = async (item: InsightHistoryItem) => {
    setItemPending(item.id, "revoke");
    const { error } = await supabase.from("insights_history" as any)
      .update({ share_token: null, expires_at: null, password_hash: null })
      .eq("id", item.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setItemPending(item.id, null);
      return;
    }
    setHistory(prev => prev.map(h => h.id === item.id
      ? { ...h, share_token: null, expires_at: null, password_hash: null } : h));
    setOpenShareItemId(null);
    await logShareEvent(item.id, "revoke", {});
    toast({ title: "Revoked", description: "Share link disabled." });
    setItemPending(item.id, null);
  };

  // === CSV EXPORT ===
  const handleExportCSV = () => {
    if (!insights) return;
    const sections = parseInsightSections(insights);
    const rows: string[][] = [["Section", "Item", "Source Document IDs"]];
    const srcIds = insightSources.map(s => s.id).join("; ");
    Object.entries(sections).forEach(([section, items]) => {
      if (items.length === 0) return;
      items.forEach(item => rows.push([section, item, srcIds]));
    });
    if (rows.length === 1) rows.push(["Insights", insights.replace(/\n/g, " "), srcIds]);
    const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-insights-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", description: `${rows.length - 1} rows downloaded.` });
  };

  // === REGENERATE FROM HISTORY (same settings) ===
  const handleRegenerateFromHistory = async (item: InsightHistoryItem) => {
    setTone(item.tone);
    setLength(item.length);
    setThemeCount(item.theme_count);
    // Use current state for the next render; build prompt inline with item settings
    if (!user || summaries.length === 0) return;
    setIsInsightsLoading(true);
    setFollowUps([]);
    setAudioUrl(null);
    try {
      const lengthInstr = item.length === "short" ? "Keep it concise — 2-3 short bullets per section."
        : item.length === "long" ? "Provide a deep, detailed analysis with rich examples and reasoning."
        : "Use a balanced level of detail.";
      const prompt = `Analyze ALL my documents collectively. Identify:
(1) the top ${item.theme_count} recurring themes,
(2) surprising connections or patterns between different documents,
(3) ${item.theme_count} knowledge gaps I should explore next,
(4) one actionable insight I can apply today.

Use a ${item.tone} tone. ${lengthInstr}
Format as clean markdown with clear section headings (## Themes, ## Connections, ## Knowledge Gaps, ## Action).
When referencing a document, wrap its title in **bold** so I can identify it.`;
      const { data, error } = await supabase.functions.invoke("search-knowledge", {
        body: { question: prompt, userId: user.id },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      setInsights(data.answer);
      setInsightSources(data.sources || []);
      const { data: saved } = await supabase
        .from("insights_history" as any)
        .insert({
          user_id: user.id,
          content: data.answer,
          tone: item.tone, length: item.length, theme_count: item.theme_count,
          document_count: summaries.length,
          source_ids: data.sources || [],
        })
        .select()
        .single();
      if (saved) {
        setHistory(prev => [saved as any, ...prev]);
        setActiveHistoryId((saved as any).id);
      }
      toast({ title: "Regenerated", description: "Fresh insights with the same settings." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed", variant: "destructive" });
    } finally {
      setIsInsightsLoading(false);
    }
  };

  // === COMPARE / DIFF ===
  const toggleCompareSelect = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const diffResult = useMemo(() => {
    if (compareIds.length !== 2) return null;
    const a = history.find(h => h.id === compareIds[0]);
    const b = history.find(h => h.id === compareIds[1]);
    if (!a || !b) return null;
    // Order by date so older = left
    const [older, newer] = new Date(a.created_at) < new Date(b.created_at) ? [a, b] : [b, a];
    return { older, newer, lines: diffLines(older.content, newer.content) };
  }, [compareIds, history]);

  // === AUDIO ===
  const handleGenerateAudio = async () => {
    if (!insights) return;
    setIsAudioLoading(true);
    try {
      // Strip markdown for cleaner narration
      const plain = insights.replace(/[#*`>_~]/g, "").replace(/\[(.+?)\]\(.+?\)/g, "$1");
      const { data, error } = await supabase.functions.invoke("generate-podcast", {
        body: { text: plain, voiceId: "JBFqnCBsd6RMkjVDRZzb" },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message || "Audio generation failed");
      setAudioUrl(`data:audio/mpeg;base64,${data.audioContent}`);
      toast({ title: "🎧 Audio ready", description: "Your insights are ready to listen." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Audio failed", variant: "destructive" });
    } finally {
      setIsAudioLoading(false);
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `ai-insights-${new Date().toISOString().slice(0, 10)}.mp3`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Render insights with clickable doc links: replace **Title** with link if matches a summary
  const renderInsightsWithLinks = (text: string) => {
    if (!text) return null;
    const summaryByTitle = new Map(summaries.map(s => [s.original_source.toLowerCase(), s]));
    return (
      <ReactMarkdown
        components={{
          strong: ({ children }) => {
            const label = String(children).trim();
            const match = summaryByTitle.get(label.toLowerCase());
            if (match) {
              return (
                <button
                  onClick={() => {
                    setSearchQuery(match.original_source);
                    setSearchResults([match]);
                    setActiveTab("search");
                  }}
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  title="Open source document"
                >
                  <FileText className="h-3 w-3 inline" />{label}
                </button>
              );
            }
            return <strong>{children}</strong>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    );
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="p-3 rounded-2xl animated-gradient">
          <Brain className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">AI Second Brain</h1>
          <p className="text-sm text-muted-foreground">
            {summaries.length} documents connected · Search & chat across your knowledge
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Documents", value: summaries.length, icon: "📄" },
          { label: "PDFs", value: summaries.filter(s => s.type === "pdf").length, icon: "📕" },
          { label: "Videos", value: summaries.filter(s => s.type === "youtube").length, icon: "🎬" },
          { label: "Insight Runs", value: history.length, icon: "💡" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-4 bg-gradient-card backdrop-blur-sm border-border/50 hover:shadow-md transition-shadow">
              <div className="text-xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 bg-muted/50">
          <TabsTrigger value="search" className="gap-2"><Search className="h-4 w-4" /> Search</TabsTrigger>
          <TabsTrigger value="chat" className="gap-2"><MessageSquare className="h-4 w-4" /> Chat</TabsTrigger>
          <TabsTrigger value="insights" className="gap-2"><Lightbulb className="h-4 w-4" /> Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search across your knowledge base..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="bg-card/50"
            />
            <Button onClick={handleSearch} disabled={isSearching} className="gap-2">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
          {searchResults.length > 0 ? (
            <div className="grid gap-3">
              <AnimatePresence>
                {searchResults.map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="p-4 bg-gradient-card backdrop-blur-sm border-border/50 hover:shadow-lg transition-all hover:scale-[1.01] cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-[10px]">{s.type}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-semibold text-sm truncate">{s.original_source}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.tldr || s.summary_text.substring(0, 150)}</p>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <Card className="p-8 text-center bg-gradient-card border-border/50">
              <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">{searchQuery ? `No results for "${searchQuery}"` : "Search across all your summaries, highlights, and notes"}</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <Card className="bg-gradient-card backdrop-blur-sm border-border/50 overflow-hidden">
            <ScrollArea className="h-[400px] p-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="p-4 rounded-full bg-primary/10 mb-3"><Sparkles className="h-8 w-8 text-primary" /></div>
                  <h3 className="font-bold text-lg mb-1">Ask your Second Brain</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">Ask questions across all your summaries. I'll find the answers and cite sources.</p>
                </div>
              )}
              <div className="space-y-4">
                {chatMessages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/70"}`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                      ) : msg.content}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/30 flex flex-wrap gap-1">
                          {msg.sources.map(src => <Badge key={src.id} variant="outline" className="text-[10px]">{src.title}</Badge>)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start"><div className="bg-muted/70 rounded-2xl px-4 py-3 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm text-muted-foreground">Thinking...</span></div></div>
                )}
              </div>
            </ScrollArea>
            <div className="p-4 border-t border-border/30 flex gap-2">
              <Input placeholder="Ask anything about your knowledge..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChat()} className="bg-background/50" />
              <Button onClick={handleChat} disabled={isChatLoading || !chatInput.trim()} size="icon"><Send className="h-4 w-4" /></Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          {summaries.length === 0 ? (
            <Card className="p-8 text-center bg-gradient-card border-border/50">
              <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">Add some summaries to unlock AI-powered insights</p>
            </Card>
          ) : (
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Controls + insights */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="p-5 bg-gradient-card backdrop-blur-sm border-border/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-xl bg-primary/10"><Lightbulb className="h-5 w-5 text-primary" /></div>
                    <div className="flex-1">
                      <h3 className="font-bold font-display">AI Insights</h3>
                      <p className="text-xs text-muted-foreground">Customize and generate</p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 mb-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tone</Label>
                      <Select value={tone} onValueChange={setTone}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{TONES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Length</Label>
                      <Select value={length} onValueChange={setLength}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{LENGTHS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Themes / gaps: <span className="text-primary font-semibold">{themeCount}</span></Label>
                      <Slider value={[themeCount]} min={3} max={10} step={1} onValueChange={v => setThemeCount(v[0])} className="pt-2" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleGenerateInsights} disabled={isInsightsLoading} size="sm" className="gap-2">
                      {isInsightsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : insights ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      {isInsightsLoading ? "Analyzing..." : insights ? "Regenerate" : "Generate Insights"}
                    </Button>
                    {insights && (
                      <>
                        <Button onClick={handleExportPDF} size="sm" variant="outline" className="gap-2">
                          <Download className="h-4 w-4" /> PDF
                        </Button>
                        <Button onClick={handleExportCSV} size="sm" variant="outline" className="gap-2">
                          <FileSpreadsheet className="h-4 w-4" /> CSV
                        </Button>
                        <Button onClick={openShareDialog} size="sm" variant="outline" className="gap-2">
                          <Share2 className="h-4 w-4" /> Share
                        </Button>
                        {activeHistoryId && history.find(h => h.id === activeHistoryId)?.share_token && (
                          <Button onClick={handleRevokeShare} size="sm" variant="ghost" className="gap-2 text-destructive">
                            <X className="h-4 w-4" /> Revoke link
                          </Button>
                        )}
                        <Button onClick={handleGenerateAudio} disabled={isAudioLoading} size="sm" variant="outline" className="gap-2">
                          {isAudioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                          {isAudioLoading ? "Generating..." : audioUrl ? "Regen audio" : "Audio"}
                        </Button>
                      </>
                    )}
                  </div>

                  {audioUrl && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                      <audio ref={audioRef} src={audioUrl}
                        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} />
                      <Button onClick={toggleAudio} size="icon" className="h-10 w-10 rounded-full animated-gradient text-primary-foreground">
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                      </Button>
                      <div className="flex-1">
                        <p className="text-xs font-semibold">Audio insights</p>
                        <p className="text-[10px] text-muted-foreground">AI-narrated · MP3</p>
                      </div>
                      <Button onClick={downloadAudio} size="sm" variant="outline" className="gap-1.5 text-xs">
                        <Download className="h-3.5 w-3.5" /> MP3
                      </Button>
                    </motion.div>
                  )}

                  <AnimatePresence mode="wait">
                    {insights ? (
                      <motion.div key="insights" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        ref={insightsPdfRef as any}
                        className="prose prose-sm dark:prose-invert max-w-none mt-4 p-4 rounded-xl bg-muted/40 border border-border/40">
                        {renderInsightsWithLinks(insights)}
                        {insightSources.length > 0 && (
                          <>
                            <Separator className="my-3" />
                            <p className="text-xs font-semibold not-prose mb-2">Source documents</p>
                            <div className="flex flex-wrap gap-1.5 not-prose">
                              {insightSources.map(src => (
                                <button key={src.id} onClick={() => {
                                  const m = summaries.find(s => s.id === src.id);
                                  if (m) { setSearchQuery(m.original_source); setSearchResults([m]); setActiveTab("search"); }
                                }}>
                                  <Badge variant="outline" className="text-[10px] hover:bg-primary/10 cursor-pointer gap-1">
                                    <FileText className="h-3 w-3" />{src.title}
                                  </Badge>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </motion.div>
                    ) : !isInsightsLoading ? (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                        <p className="text-sm text-muted-foreground">Click <span className="font-semibold text-foreground">Generate Insights</span> to analyze {summaries.length} documents.</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </Card>

                {/* Follow-up Q&A */}
                {insights && (
                  <Card className="p-5 bg-gradient-card backdrop-blur-sm border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Ask follow-up questions about these insights</h3>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto mb-3">
                      {followUps.map((f, i) => (
                        <div key={i} className={`flex ${f.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${f.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/70"}`}>
                            {f.role === "assistant" ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{f.content}</ReactMarkdown></div>
                            ) : f.content}
                          </div>
                        </div>
                      ))}
                      {isFollowUpLoading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Thinking...</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. Which theme should I prioritize?"
                        value={followUpInput}
                        onChange={e => setFollowUpInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleFollowUp()}
                      />
                      <Button onClick={handleFollowUp} disabled={isFollowUpLoading || !followUpInput.trim()} size="icon">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                )}
              </div>

              {/* History */}
              <Card className="p-4 bg-gradient-card backdrop-blur-sm border-border/50 lg:max-h-[700px] overflow-y-auto">
                <div className="flex items-center gap-2 mb-3">
                  <HistoryIcon className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm flex-1">Insights History</h3>
                  <Button size="sm" variant={compareMode ? "default" : "ghost"} className="h-7 text-[10px] gap-1"
                    onClick={() => { setCompareMode(m => !m); setCompareIds([]); setShowDiff(false); }}>
                    <GitCompare className="h-3 w-3" /> {compareMode ? "Cancel" : "Compare"}
                  </Button>
                </div>
                {compareMode && (
                  <div className="mb-3 p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-[10px] text-muted-foreground mb-1.5">Select 2 runs to diff ({compareIds.length}/2)</p>
                    <Button size="sm" disabled={compareIds.length !== 2} className="h-7 text-[10px] w-full gap-1"
                      onClick={() => setShowDiff(true)}>
                      <GitCompare className="h-3 w-3" /> Show diff
                    </Button>
                  </div>
                )}
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No previous runs yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.map(item => (
                      <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className={`p-3 rounded-lg border bg-background/40 hover:border-primary/40 transition-all group ${
                          compareMode && compareIds.includes(item.id) ? "border-primary ring-1 ring-primary/40" :
                          activeHistoryId === item.id ? "border-primary/60" : "border-border/50"
                        }`}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
                          <div className="flex items-center gap-1">
                            {item.share_token && <Link2 className="h-3 w-3 text-primary" />}
                            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteHistoryItem(item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <Badge variant="secondary" className="text-[9px]">{item.tone}</Badge>
                          <Badge variant="secondary" className="text-[9px]">{item.length}</Badge>
                          <Badge variant="secondary" className="text-[9px]">{item.theme_count} themes</Badge>
                          <Badge variant="outline" className="text-[9px]">{item.document_count} docs</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {item.content.replace(/[#*`]/g, "").substring(0, 120)}
                        </p>
                        {compareMode ? (
                          <Button size="sm" variant={compareIds.includes(item.id) ? "default" : "outline"}
                            className="h-7 text-xs w-full gap-1" onClick={() => toggleCompareSelect(item.id)}>
                            {compareIds.includes(item.id) ? <><Check className="h-3 w-3" /> Selected</> : "Select"}
                          </Button>
                        ) : (
                          <>
                            <div className="grid grid-cols-3 gap-1.5">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => loadHistoryItem(item)}>
                                Load
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleRegenerateFromHistory(item)}
                                disabled={isInsightsLoading} title="Regenerate with same settings">
                                <RefreshCw className="h-3 w-3" /> Rerun
                              </Button>
                              <Button size="sm"
                                variant={item.share_token ? "default" : "outline"}
                                className="h-7 text-xs gap-1"
                                onClick={() => {
                                  setOpenShareItemId(prev => {
                                    const next = prev === item.id ? null : item.id;
                                    if (next) loadShareEvents(item.id);
                                    return next;
                                  });
                                }}
                                title="Manage share link">
                                <Settings2 className="h-3 w-3" /> Share
                              </Button>
                            </div>
                            <AnimatePresence>
                              {openShareItemId === item.id && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden">
                                  <div className="mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                                    {!item.share_token ? (
                                      <>
                                        <p className="text-[10px] text-muted-foreground">
                                          No share link yet. Use the main Share button after loading this run to configure expiration and password.
                                        </p>
                                        <Button size="sm" variant="outline" className="h-7 text-[10px] w-full gap-1"
                                          onClick={() => { loadHistoryItem(item); openShareDialog(); }}>
                                          <Share2 className="h-3 w-3" /> Create share link
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex items-center gap-1.5">
                                          <Input
                                            readOnly
                                            value={`${window.location.origin}/insights/shared/${item.share_token}`}
                                            className="h-7 text-[10px] font-mono px-2"
                                            onFocus={e => e.target.select()}
                                          />
                                          <Button size="icon" variant="outline" className="h-7 w-7 shrink-0"
                                            onClick={() => copyItemLink(item)}
                                            disabled={!!itemPendingAction[item.id]}
                                            title="Copy link">
                                            {itemPendingAction[item.id] === "copy"
                                              ? <Loader2 className="h-3 w-3 animate-spin" />
                                              : copiedItemId === item.id
                                              ? <Check className="h-3 w-3 text-emerald-500" />
                                              : <Link2 className="h-3 w-3" />}
                                          </Button>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 text-[10px]">
                                          <span className="text-muted-foreground inline-flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {item.expires_at
                                              ? (new Date(item.expires_at).getTime() <= Date.now()
                                                  ? <span className="text-destructive font-medium">Expired</span>
                                                  : <>Expires {new Date(item.expires_at).toLocaleString()}</>)
                                              : <span className="text-emerald-600 dark:text-emerald-400">Never expires</span>}
                                          </span>
                                          {item.password_hash && (
                                            <Badge variant="secondary" className="text-[9px] gap-1 py-0">
                                              🔒 Password
                                            </Badge>
                                          )}
                                        </div>

                                        <div>
                                          <p className="text-[10px] text-muted-foreground mb-1">Extend expiration</p>
                                          <div className="grid grid-cols-4 gap-1">
                                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-1 gap-0.5"
                                              onClick={() => extendItemExpiration(item, 60 * 60 * 1000)}
                                              disabled={!!itemPendingAction[item.id]}>
                                              {itemPendingAction[item.id] === "extend"
                                                ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                : <Plus className="h-2.5 w-2.5" />}1h
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-1 gap-0.5"
                                              onClick={() => extendItemExpiration(item, 24 * 60 * 60 * 1000)}
                                              disabled={!!itemPendingAction[item.id]}>
                                              <Plus className="h-2.5 w-2.5" />1d
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-1 gap-0.5"
                                              onClick={() => extendItemExpiration(item, 7 * 24 * 60 * 60 * 1000)}
                                              disabled={!!itemPendingAction[item.id]}>
                                              <Plus className="h-2.5 w-2.5" />7d
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-1"
                                              onClick={() => setItemNeverExpires(item)}
                                              disabled={!!itemPendingAction[item.id]}
                                              title="Remove expiration">
                                              {itemPendingAction[item.id] === "never"
                                                ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                : "∞"}
                                            </Button>
                                          </div>
                                        </div>

                                        <Button size="sm" variant="ghost"
                                          className="h-7 text-[10px] w-full gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={() => revokeItemShare(item)}
                                          disabled={!!itemPendingAction[item.id]}>
                                          {itemPendingAction[item.id] === "revoke"
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : <X className="h-3 w-3" />} Revoke link
                                        </Button>
                                      </>
                                    )}

                                    {/* Audit log */}
                                    <div className="pt-2 mt-1 border-t border-border/40">
                                      <div className="flex items-center justify-between gap-1 mb-1.5">
                                        <div className="flex items-center gap-1">
                                          <Activity className="h-3 w-3 text-muted-foreground" />
                                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                            Activity
                                          </p>
                                        </div>
                                         <Button size="sm" variant="ghost"
                                           className="h-6 px-1.5 text-[10px] gap-1"
                                           onClick={() => { setCsvTargetItem(item); setCsvConfirmOpen(true); }}
                                           disabled={(itemTotalEvents[item.id] ?? 0) === 0}>
                                           <Download className="h-3 w-3" /> CSV
                                         </Button>
                                      </div>

                                      {/* Summary */}
                                      {(() => {
                                        const total = itemTotalEvents[item.id] ?? 0;
                                        const last = itemEvents[item.id]?.[0]?.created_at;
                                        return (
                                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5 px-1.5 py-1 rounded bg-muted/40">
                                            <span>{total} event{total === 1 ? "" : "s"}</span>
                                            <span>{last ? `Last: ${new Date(last).toLocaleString()}` : "No activity"}</span>
                                          </div>
                                        );
                                      })()}

                                      {/* Filters */}
                                      <div className="grid grid-cols-3 gap-1 mb-1.5">
                                        <Select
                                          value={getAuditFilter(item.id).type}
                                          onValueChange={(v) => updateAuditFilter(item.id, { type: v })}>
                                          <SelectTrigger className="h-6 text-[10px] px-1.5">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="all" className="text-xs">All events</SelectItem>
                                            <SelectItem value="create" className="text-xs">Create</SelectItem>
                                            <SelectItem value="update" className="text-xs">Update</SelectItem>
                                            <SelectItem value="extend" className="text-xs">Extend</SelectItem>
                                            <SelectItem value="copy" className="text-xs">Copy</SelectItem>
                                            <SelectItem value="revoke" className="text-xs">Revoke</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <Input
                                          type="date"
                                          value={getAuditFilter(item.id).from}
                                          onChange={(e) => updateAuditFilter(item.id, { from: e.target.value })}
                                          className="h-6 text-[10px] px-1.5"
                                          title="From date"
                                        />
                                        <Input
                                          type="date"
                                          value={getAuditFilter(item.id).to}
                                          onChange={(e) => updateAuditFilter(item.id, { to: e.target.value })}
                                          className="h-6 text-[10px] px-1.5"
                                          title="To date"
                                        />
                                      </div>

                                      {(itemEvents[item.id]?.length ?? 0) === 0 ? (
                                        <p className="text-[10px] text-muted-foreground italic">No events yet.</p>
                                      ) : (
                                        <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                          {itemEvents[item.id].map(ev => {
                                            const icon = ev.event_type === "create" ? "🔗"
                                              : ev.event_type === "update" ? "✏️"
                                              : ev.event_type === "extend" ? "⏱️"
                                              : ev.event_type === "revoke" ? "🚫"
                                              : ev.event_type === "copy" ? "📋"
                                              : "•";
                                            const label = ev.event_type === "extend" && ev.metadata?.new_expires_at === null
                                              ? "set to never expire"
                                              : ev.event_type === "extend" && ev.metadata?.new_expires_at
                                              ? `extended to ${new Date(ev.metadata.new_expires_at).toLocaleString()}`
                                              : ev.event_type === "create"
                                              ? `link created${ev.metadata?.has_password ? " (password)" : ""}`
                                              : ev.event_type === "update"
                                              ? `settings updated${ev.metadata?.has_password ? " (password)" : ""}`
                                              : ev.event_type === "revoke"
                                              ? "link revoked"
                                              : ev.event_type === "copy"
                                              ? "link copied"
                                              : ev.event_type;
                                            return (
                                              <li key={ev.id} className="flex items-start gap-1.5 text-[10px]">
                                                <span>{icon}</span>
                                                <span className="flex-1">
                                                  <span className="text-foreground">{label}</span>
                                                  <span className="text-muted-foreground"> · {new Date(ev.created_at).toLocaleString()}</span>
                                                </span>
                                              </li>
                                            );
                                          })}
                                          {itemHasMore[item.id] && (
                                            <li>
                                              <Button size="sm" variant="ghost"
                                                className="h-6 w-full text-[10px] gap-1"
                                                onClick={() => loadMoreEvents(item.id)}
                                                disabled={itemLoadingEvents[item.id]}>
                                                {itemLoadingEvents[item.id]
                                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                                  : <Plus className="h-3 w-3" />} Load more
                                              </Button>
                                            </li>
                                          )}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Diff overlay */}
      <AnimatePresence>
        {showDiff && diffResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDiff(false)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-card border border-border/60 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-border/40 flex items-center gap-3">
                <GitCompare className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <h3 className="font-bold font-display text-sm">Insights Diff</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(diffResult.older.created_at).toLocaleString()} → {new Date(diffResult.newer.created_at).toLocaleString()}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setShowDiff(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="overflow-y-auto p-4 font-mono text-xs leading-relaxed">
                {diffResult.lines.map((l, i) => (
                  <div key={i} className={`px-2 py-0.5 rounded whitespace-pre-wrap break-words ${
                    l.type === "added" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-l-2 border-emerald-500" :
                    l.type === "removed" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-l-2 border-rose-500 line-through opacity-80" :
                    "text-muted-foreground"
                  }`}>
                    <span className="opacity-50 mr-2">{l.type === "added" ? "+" : l.type === "removed" ? "−" : " "}</span>
                    {l.text || " "}
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                <div className="flex gap-3">
                  <span><span className="text-emerald-500">+</span> {diffResult.lines.filter(l => l.type === "added").length} added</span>
                  <span><span className="text-rose-500">−</span> {diffResult.lines.filter(l => l.type === "removed").length} removed</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowDiff(false)}>Close</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Share2 className="h-4 w-4 text-primary" /> Share insights</DialogTitle>
            <DialogDescription className="text-xs">
              Anyone with this link can view this insight report (read-only).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Expires</Label>
              <Select value={shareExpiresIn} onValueChange={setShareExpiresIn}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="1h">In 1 hour</SelectItem>
                  <SelectItem value="24h">In 24 hours</SelectItem>
                  <SelectItem value="7d">In 7 days</SelectItem>
                  <SelectItem value="30d">In 30 days</SelectItem>
                  <SelectItem value="custom">Custom date/time…</SelectItem>
                </SelectContent>
              </Select>
              {shareExpiresIn === "custom" && (
                <Input type="datetime-local" value={shareCustomExpires}
                  onChange={e => setShareCustomExpires(e.target.value)}
                  min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)} className="h-9 mt-1.5" />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Password (optional)</Label>
              <Input type="text" placeholder="Leave empty for no password"
                value={sharePassword} maxLength={64}
                onChange={e => setSharePassword(e.target.value)} className="h-9" />
              <p className="text-[10px] text-muted-foreground">Recipients will be required to enter this password to view.</p>
            </div>

            {shareUrl && (
              <div className="space-y-1.5">
                <Label className="text-xs">Shareable link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={shareUrl} className="h-9 font-mono text-[11px]" onFocus={e => e.target.select()} />
                  <Button onClick={handleCopyShareUrl} size="sm" variant="outline" className="gap-1.5 shrink-0">
                    {shareCopied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Link2 className="h-3.5 w-3.5" /> Copy</>}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {activeHistoryId && history.find(h => h.id === activeHistoryId)?.share_token && (
              <Button variant="ghost" className="text-destructive gap-1.5"
                onClick={async () => { await handleRevokeShare(); setShareDialogOpen(false); }}>
                <X className="h-4 w-4" /> Revoke
              </Button>
            )}
            <Button onClick={handleCreateShare} disabled={isSavingShare || (shareExpiresIn === "custom" && !shareCustomExpires)} className="gap-1.5">
              {isSavingShare ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              {shareUrl ? "Update link" : "Create link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function csvEscape(s: string) {
  const v = (s ?? "").replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

// Parse markdown insight sections (## Themes / Connections / Knowledge Gaps / Action) into arrays of items.
function parseInsightSections(md: string): Record<string, string[]> {
  const sections: Record<string, string[]> = { Themes: [], Connections: [], "Knowledge Gaps": [], Action: [] };
  const lines = md.split("\n");
  let current: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^#{1,3}\s*(.+)$/);
    if (h) {
      const title = h[1].toLowerCase();
      if (title.includes("theme")) current = "Themes";
      else if (title.includes("connect")) current = "Connections";
      else if (title.includes("gap")) current = "Knowledge Gaps";
      else if (title.includes("action")) current = "Action";
      else current = null;
      continue;
    }
    if (!current) continue;
    const item = line.match(/^[-*\d+.]+\s*(.+)$/);
    if (item) {
      const clean = item[1].replace(/\*\*/g, "").trim();
      if (clean) sections[current].push(clean);
    }
  }
  return sections;
}

function markdownToHtml(md: string) {
  // Lightweight markdown → HTML for the print PDF
  let html = escapeHtml(md);
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^\s*[-*] (.*)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  html = html.replace(/\n{2,}/g, "</p><p>");
  return `<p>${html}</p>`;
}
