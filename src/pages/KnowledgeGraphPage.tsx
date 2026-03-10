import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Share2, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
}

export default function KnowledgeGraphPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchSummaries();
  }, [user]);

  const fetchSummaries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("summaries")
      .select("id, original_source, summary_text, extracted_text, type, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setSummaries((data as Summary[]) || []);
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display flex items-center gap-3">
          <div className="p-2.5 rounded-xl animated-gradient">
            <Share2 className="h-5 w-5 text-primary-foreground" />
          </div>
          Knowledge Graph
        </h1>
        <p className="text-muted-foreground mt-2">Visualize concepts and relationships from your content</p>
      </div>

      {selectedSummary ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <button
            onClick={() => setSelectedSummary(null)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to summaries
          </button>
          <KnowledgeGraph text={selectedSummary.extracted_text || selectedSummary.summary_text} summary={selectedSummary.summary_text} />
        </motion.div>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="glass-card p-6">
              <Skeleton className="h-5 w-3/4 mb-3" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          ))}
        </div>
      ) : summaries.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No summaries yet. Create one from the Dashboard first!</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {summaries.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card
                className="glass-card p-6 cursor-pointer hover:border-primary/40 transition-all group"
                onClick={() => setSelectedSummary(s)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <Share2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{s.original_source || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">{s.type} · {new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
