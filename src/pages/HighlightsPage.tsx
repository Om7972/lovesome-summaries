import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, FileText, Youtube, Video, Search, Clock, Zap, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { EmptyState, SummaryListSkeleton } from "@/components/EmptyState";
import { ExportMenu } from "@/components/ExportMenu";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportHighlightsJSON, exportHighlightsPDF } from "@/lib/export-utils";

interface Summary {
  id: string;
  original_source: string;
  summary_text: string;
  extracted_text: string;
  type: string;
  created_at: string;
  word_count: number;
}

interface Highlight {
  timestamp: string;
  description: string;
  importance: "high" | "medium" | "low";
}

const typeIcons: Record<string, any> = { pdf: FileText, youtube: Youtube, video: Video };
const typeColors: Record<string, string> = {
  pdf: "bg-primary/10 text-primary",
  youtube: "bg-destructive/10 text-destructive",
  video: "bg-accent/10 text-accent",
};

const importanceConfig = {
  high: { icon: Flame, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", label: "Critical" },
  medium: { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Important" },
  low: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border/50", label: "Notable" },
};

export default function HighlightsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [search, setSearch] = useState("");
  const [importanceFilter, setImportanceFilter] = useState<string>("all");

  useEffect(() => {
    if (user) fetchSummaries();
  }, [user]);

  const fetchSummaries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("summaries")
      .select("id, original_source, summary_text, extracted_text, type, created_at, word_count")
      .order("created_at", { ascending: false })
      .limit(50);
    setSummaries((data as Summary[]) || []);
    setLoading(false);
  };

  const detectHighlights = async (summary: Summary) => {
    setSelectedSummary(summary);
    setDetecting(true);
    setHighlights([]);
    try {
      const { data, error } = await supabase.functions.invoke("detect-highlights", {
        body: { text: summary.extracted_text || summary.summary_text, contentType: summary.type, timestamps: [] },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      setHighlights(data.highlights || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to detect highlights", variant: "destructive" });
    } finally {
      setDetecting(false);
    }
  };

  const handleTimestampClick = (timestamp: string) => {
    if (!selectedSummary || selectedSummary.type !== "youtube") return;
    const parts = timestamp.split(":").map(Number);
    let seconds = 0;
    if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    const videoId = selectedSummary.original_source.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (videoId) window.open(`https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`, "_blank");
  };

  const filtered = summaries.filter(s =>
    !search || s.original_source.toLowerCase().includes(search.toLowerCase())
  );

  const filteredHighlights = highlights.filter(h =>
    importanceFilter === "all" || h.importance === importanceFilter
  );

  const highCount = highlights.filter(h => h.importance === "high").length;
  const medCount = highlights.filter(h => h.importance === "medium").length;
  const lowCount = highlights.filter(h => h.importance === "low").length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display flex items-center gap-3">
          <div className="p-2.5 rounded-xl animated-gradient">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          Smart Highlights
        </h1>
        <p className="text-muted-foreground mt-2">AI-detected key moments and important sections from your content</p>
      </div>

      {selectedSummary ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <button
            onClick={() => { setSelectedSummary(null); setHighlights([]); setImportanceFilter("all"); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to summaries
          </button>

          {/* Summary info */}
          <Card className="glass-card-strong p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${typeColors[selectedSummary.type] || "bg-primary/10 text-primary"}`}>
                  {(() => { const Icon = typeIcons[selectedSummary.type] || FileText; return <Icon className="h-5 w-5" />; })()}
                </div>
                <div>
                  <p className="font-semibold font-display">{selectedSummary.original_source || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedSummary.type} · {new Date(selectedSummary.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {highlights.length > 0 && (
                <ExportMenu
                  onExportJSON={() => exportHighlightsJSON(highlights, selectedSummary.original_source)}
                  onExportPDF={() => exportHighlightsPDF(highlights, selectedSummary.original_source)}
                />
              )}
            </div>
          </Card>

          {detecting ? (
            <Card className="glass-card p-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Detecting key moments...</p>
            </Card>
          ) : highlights.length === 0 ? (
            <Card className="glass-card p-12 text-center">
              <p className="text-muted-foreground">No highlights detected.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">{highlights.length} highlights found</span>
                <div className="flex gap-2 ml-auto">
                  {[
                    { key: "all", label: "All", count: highlights.length },
                    { key: "high", label: "Critical", count: highCount },
                    { key: "medium", label: "Important", count: medCount },
                    { key: "low", label: "Notable", count: lowCount },
                  ].map(f => (
                    <Button
                      key={f.key}
                      variant={importanceFilter === f.key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImportanceFilter(f.key)}
                      className="text-xs gap-1"
                    >
                      {f.label} <span className="opacity-60">({f.count})</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-3">
                  {filteredHighlights.map((h, i) => {
                    const config = importanceConfig[h.importance] || importanceConfig.medium;
                    const Icon = config.icon;
                    const isClickable = selectedSummary.type === "youtube";
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="relative pl-14"
                      >
                        {/* Timeline dot */}
                        <div className={`absolute left-4 top-3 h-5 w-5 rounded-full ${config.bg} border-2 ${config.border} flex items-center justify-center`}>
                          <Icon className={`h-2.5 w-2.5 ${config.color}`} />
                        </div>

                        <Card className={`glass-card p-4 border ${config.border} hover:shadow-md transition-all`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                                  {config.label}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium leading-relaxed">{h.description}</p>
                            </div>
                            <button
                              onClick={() => isClickable && handleTimestampClick(h.timestamp)}
                              className={`shrink-0 flex items-center gap-1 text-xs font-mono px-3 py-1.5 rounded-lg ${
                                isClickable
                                  ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {h.timestamp}
                              {isClickable && <ExternalLink className="h-3 w-3" />}
                            </button>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      ) : loading ? (
        <SummaryListSkeleton count={6} />
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={Flame}
          title="No content to highlight"
          description="Create your first summary from the Dashboard, then come back to detect key moments."
        />
      ) : (
        <div className="space-y-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search summaries..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((s, i) => {
              const Icon = typeIcons[s.type] || FileText;
              return (
                <motion.div key={s.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Card
                    className="glass-card p-5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
                    onClick={() => detectHighlights(s)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 ${typeColors[s.type] || "bg-primary/10 text-primary"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{s.original_source || "Untitled"}</p>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">{s.type} · {new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        Detect Highlights →
                      </span>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
