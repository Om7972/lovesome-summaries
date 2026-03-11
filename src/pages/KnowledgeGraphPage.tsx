import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Share2, FileText, Network, Youtube, Video, Search, BarChart3, Sparkles } from "lucide-react";
import { EmptyState, SummaryListSkeleton } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Summary {
  id: string;
  original_source: string;
  summary_text: string;
  extracted_text: string;
  type: string;
  created_at: string;
  word_count: number;
}

const typeIcons: Record<string, any> = { pdf: FileText, youtube: Youtube, video: Video };
const typeColors: Record<string, string> = {
  pdf: "bg-primary/10 text-primary",
  youtube: "bg-destructive/10 text-destructive",
  video: "bg-accent/10 text-accent",
};

export default function KnowledgeGraphPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

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

  const filtered = summaries.filter(s => {
    const matchSearch = !search || s.original_source.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || s.type === typeFilter;
    return matchSearch && matchType;
  });

  const typeCounts = {
    all: summaries.length,
    pdf: summaries.filter(s => s.type === "pdf").length,
    youtube: summaries.filter(s => s.type === "youtube").length,
    video: summaries.filter(s => s.type === "video").length,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <div className="p-2.5 rounded-xl animated-gradient">
              <Share2 className="h-5 w-5 text-primary-foreground" />
            </div>
            Knowledge Graph
          </h1>
          <p className="text-muted-foreground mt-2">Visualize concepts and relationships from your content</p>
        </div>
        {!selectedSummary && summaries.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="font-semibold text-foreground">{summaries.length}</span> documents ready
            </div>
          </div>
        )}
      </div>

      {selectedSummary ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedSummary(null)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              ← Back to summaries
            </button>
            <Badge variant="outline" className="capitalize gap-1.5">
              {(() => { const Icon = typeIcons[selectedSummary.type] || FileText; return <Icon className="h-3 w-3" />; })()}
              {selectedSummary.type}
            </Badge>
          </div>
          <Card className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${typeColors[selectedSummary.type] || "bg-primary/10 text-primary"}`}>
                {(() => { const Icon = typeIcons[selectedSummary.type] || FileText; return <Icon className="h-5 w-5" />; })()}
              </div>
              <div>
                <p className="font-semibold font-display">{selectedSummary.original_source || "Untitled"}</p>
                <p className="text-xs text-muted-foreground">{new Date(selectedSummary.created_at).toLocaleDateString()} · {selectedSummary.word_count} words</p>
              </div>
            </div>
          </Card>
          <KnowledgeGraph text={selectedSummary.extracted_text || selectedSummary.summary_text} summary={selectedSummary.summary_text} />
        </motion.div>
      ) : loading ? (
        <SummaryListSkeleton count={6} />
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No content to visualize"
          description="Create your first summary from the Dashboard, then come back here to explore the knowledge graph."
        />
      ) : (
        <div className="space-y-6">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "pdf", "youtube", "video"] as const).map(t => (
                <Button
                  key={t}
                  variant={typeFilter === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter(t)}
                  className="capitalize text-xs gap-1.5"
                >
                  {t} {typeCounts[t] > 0 && <span className="opacity-60">({typeCounts[t]})</span>}
                </Button>
              ))}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Documents", value: summaries.length, icon: FileText },
              { label: "Total Words", value: `${Math.round(summaries.reduce((a, s) => a + (s.word_count || 0), 0) / 1000)}k`, icon: BarChart3 },
              { label: "Graph Ready", value: filtered.length, icon: Sparkles },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="glass-card p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <stat.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-bold font-display">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Document Grid */}
          {filtered.length === 0 ? (
            <Card className="glass-card p-12 text-center">
              <p className="text-muted-foreground">No matching documents found.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s, i) => {
                const Icon = typeIcons[s.type] || FileText;
                return (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Card
                      className="glass-card p-5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
                      onClick={() => setSelectedSummary(s)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl shrink-0 ${typeColors[s.type] || "bg-primary/10 text-primary"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{s.original_source || "Untitled"}</p>
                          <p className="text-xs text-muted-foreground mt-1 capitalize">{s.type} · {new Date(s.created_at).toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{s.summary_text.substring(0, 100)}...</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <Badge variant="secondary" className="text-[10px]">{s.word_count} words</Badge>
                        <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                          Generate Graph →
                        </span>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
