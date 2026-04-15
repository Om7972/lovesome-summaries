import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Headphones, FileText, Mic, Youtube, Video, Search, Music, Clock } from "lucide-react";
import { EmptyState, SummaryListSkeleton } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PodcastPlayer } from "@/components/PodcastPlayer";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Summary {
  id: string;
  original_source: string;
  summary_text: string;
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

export default function PodcastPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user) fetchSummaries();
  }, [user]);

  const fetchSummaries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("summaries")
      .select("id, original_source, summary_text, type, created_at, word_count")
      .order("created_at", { ascending: false })
      .limit(50);
    setSummaries((data as Summary[]) || []);
    setLoading(false);
  };

  const filtered = summaries.filter(s =>
    !search || s.original_source.toLowerCase().includes(search.toLowerCase())
  );

  const estimatedDuration = (wc: number) => Math.max(1, Math.round(wc / 150));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <div className="p-2.5 rounded-xl animated-gradient">
              <Headphones className="h-5 w-5 text-primary-foreground" />
            </div>
            Podcast Generator
          </h1>
          <p className="text-muted-foreground mt-2">Convert your summaries into audio podcasts with AI voices</p>
        </div>
        {!selectedSummary && summaries.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Music className="h-4 w-4" />
            <span className="font-semibold text-foreground">{summaries.length}</span> summaries available
          </div>
        )}
      </div>

      {selectedSummary ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <button
            onClick={() => setSelectedSummary(null)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to summaries
          </button>

          {/* Selected summary info card */}
          <Card className="glass-card-strong p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${typeColors[selectedSummary.type] || "bg-primary/10 text-primary"}`}>
                {(() => { const Icon = typeIcons[selectedSummary.type] || FileText; return <Icon className="h-5 w-5" />; })()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold font-display text-lg truncate">{selectedSummary.original_source || "Untitled"}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="secondary" className="capitalize text-xs">{selectedSummary.type}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(selectedSummary.created_at).toLocaleDateString()}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> ~{estimatedDuration(selectedSummary.word_count)} min audio
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <PodcastPlayer summary={selectedSummary.summary_text} />
        </motion.div>
      ) : loading ? (
        <SummaryListSkeleton count={6} />
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={Mic}
          title="No summaries to convert"
          description="Create your first summary from the Dashboard, then come back here to turn it into a podcast."
        />
      ) : (
        <div className="space-y-6">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search summaries..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* How it works */}
          <Card className="glass-card p-5">
            <div className="flex flex-wrap items-center gap-6 text-sm">
              {[
                { step: "1", text: "Select a summary" },
                { step: "2", text: "Choose an AI voice" },
                { step: "3", text: "Generate & listen" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full animated-gradient text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {s.step}
                  </div>
                  <span className="text-muted-foreground">{s.text}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Grid */}
          <div className="grid gap-4 md:grid-cols-2">
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
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> ~{estimatedDuration(s.word_count)} min
                      </div>
                      <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        Generate Podcast →
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
