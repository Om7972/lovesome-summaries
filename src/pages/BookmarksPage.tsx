import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bookmark, Trash2, Search, SlidersHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function BookmarksPage() {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [importanceFilter, setImportanceFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchBookmarks = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("highlights")
      .select("*, summaries(original_source, type)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setHighlights(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchBookmarks(); }, [user]);

  const deleteBookmark = async (id: string) => {
    await supabase.from("highlights").delete().eq("id", id);
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    toast.success("Bookmark removed");
  };

  const filtered = highlights
    .filter((h) => importanceFilter === "all" || h.importance === importanceFilter)
    .filter((h) => !search || h.description.toLowerCase().includes(search.toLowerCase()));

  const importanceBadge: Record<string, string> = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-primary/10 text-primary border-primary/20",
    low: "bg-muted text-muted-foreground border-border",
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 max-w-5xl mx-auto">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Bookmark className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display gradient-text">Bookmarks</h1>
            <p className="text-muted-foreground text-sm">Your saved insights and highlights</p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bookmarks..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          {["all", "high", "medium", "low"].map((level) => (
            <Badge
              key={level}
              variant={importanceFilter === level ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => setImportanceFilter(level)}
            >
              {level}
            </Badge>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading bookmarks...</div>
      ) : filtered.length === 0 ? (
        <motion.div variants={itemVariants} className="text-center py-16">
          <Bookmark className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No bookmarks found</p>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="grid gap-4 sm:grid-cols-2">
          {filtered.map((h) => (
            <motion.div key={h.id} variants={itemVariants} whileHover={{ scale: 1.02, boxShadow: "0 0 30px hsl(var(--primary) / 0.15)" }}>
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-full">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm leading-relaxed flex-1">{h.description}</p>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteBookmark(h.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs ${importanceBadge[h.importance] || ""}`}>{h.importance}</Badge>
                    {h.summaries?.type && <Badge variant="outline" className="text-xs">{h.summaries.type}</Badge>}
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(h.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
