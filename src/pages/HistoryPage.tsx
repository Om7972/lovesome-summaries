import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Video, Youtube, Trash2, Eye, Clock, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Summary {
  id: string;
  type: string;
  original_source: string;
  summary_text: string;
  word_count: number;
  created_at: string;
}

const typeIcons: Record<string, any> = {
  pdf: FileText,
  video: Video,
  youtube: Youtube,
};

export default function HistoryPage() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [viewSummary, setViewSummary] = useState<Summary | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSummaries = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("summaries")
      .select("id, type, original_source, summary_text, word_count, created_at")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("type", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error", description: "Failed to load history.", variant: "destructive" });
    } else {
      setSummaries((data as Summary[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSummaries();
  }, [user, filter]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("summaries").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    } else {
      setSummaries((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Deleted", description: "Summary removed." });
    }
  };

  const readingTime = (wordCount: number) => Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display">History</h1>
          <p className="text-muted-foreground mt-1">{summaries.length} summaries</p>
        </div>
        <div className="flex gap-2">
          {["all", "pdf", "youtube", "video"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f === "all" ? <Filter className="h-3 w-3 mr-1" /> : null}
              {f}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : summaries.length === 0 ? (
        <Card className="p-12 text-center glass-card-strong">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No summaries yet</h3>
          <p className="text-muted-foreground">Go to the dashboard to create your first summary.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {summaries.map((item, idx) => {
            const Icon = typeIcons[item.type] || FileText;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="p-5 glass-card flex items-center gap-4 group hover:border-primary/30 transition-all">
                  <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{item.original_source || "Untitled"}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="capitalize bg-muted px-2 py-0.5 rounded">{item.type}</span>
                      <span>{item.word_count} words</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {readingTime(item.word_count)} min read
                      </span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => setViewSummary(item)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* View Modal */}
      <Dialog open={!!viewSummary} onOpenChange={() => setViewSummary(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-display">{viewSummary?.original_source}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <p className="whitespace-pre-wrap leading-relaxed text-sm">{viewSummary?.summary_text}</p>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
