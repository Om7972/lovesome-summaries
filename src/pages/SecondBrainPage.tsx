import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, Search, MessageSquare, Lightbulb, Loader2, Send, Sparkles, RefreshCw, Download, History as HistoryIcon, Trash2, FileText } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { downloadTextAsPDF } from "@/lib/export-utils";
import ReactMarkdown from "react-markdown";

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

  // Follow-up Q&A
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUps, setFollowUps] = useState<ChatMessage[]>([]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);

  const insightsPdfRef = useRef<HTMLDivElement>(null);

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
      if (saved) setHistory(prev => [saved as any, ...prev]);
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
    toast({ title: "Loaded", description: `Insights from ${new Date(item.created_at).toLocaleString()}` });
  };

  const deleteHistoryItem = async (id: string) => {
    await supabase.from("insights_history" as any).delete().eq("id", id);
    setHistory(prev => prev.filter(h => h.id !== id));
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
                      <Button onClick={handleExportPDF} size="sm" variant="outline" className="gap-2">
                        <Download className="h-4 w-4" /> Export PDF
                      </Button>
                    )}
                  </div>

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
                  <h3 className="font-semibold text-sm">Insights History</h3>
                </div>
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No previous runs yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.map(item => (
                      <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="p-3 rounded-lg border border-border/50 bg-background/40 hover:border-primary/40 transition-all group">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteHistoryItem(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
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
                        <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={() => loadHistoryItem(item)}>
                          Load
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
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
