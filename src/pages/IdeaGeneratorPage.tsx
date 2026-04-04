import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Idea {
  title: string;
  description: string;
  category: string;
  impact: "high" | "medium" | "low";
}

const impactColors: Record<string, string> = {
  high: "bg-success/10 text-success border-success/20",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export default function IdeaGeneratorPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<any[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<string>("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("summaries")
      .select("id, original_source, type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setSummaries(data || []));
  }, [user]);

  const generateIdeas = async () => {
    if (!selectedSummary) {
      toast.error("Select a summary first");
      return;
    }
    setLoading(true);
    try {
      const { data: s } = await supabase
        .from("summaries")
        .select("summary_text, key_points")
        .eq("id", selectedSummary)
        .single();
      if (!s) throw new Error("Summary not found");

      const prompt = `Based on this summary, generate 8 actionable ideas. Summary: ${s.summary_text?.substring(0, 2000)}. Key points: ${JSON.stringify(s.key_points)}.\n\nReturn JSON array: [{"title":"...","description":"...","category":"content|research|business|learning","impact":"high|medium|low"}]`;

      const { data: aiData, error } = await supabase.functions.invoke("answer-question", {
        body: { question: prompt, context: "" },
      });
      if (error) throw error;
      const text = aiData?.answer || "";
      const match = text.match(/\[[\s\S]*\]/);
      if (match) setIdeas(JSON.parse(match[0]));
      else toast.error("Could not parse ideas");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const categories = [...new Set(ideas.map((i) => i.category))];
  const filtered = filter === "all" ? ideas : ideas.filter((i) => i.category === filter);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 max-w-5xl mx-auto">
      <motion.div variants={cardVariants}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Lightbulb className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display gradient-text">Idea Generator</h1>
            <p className="text-muted-foreground text-sm">Turn your summaries into actionable ideas</p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={cardVariants} className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Summary</label>
          <Select value={selectedSummary} onValueChange={setSelectedSummary}>
            <SelectTrigger><SelectValue placeholder="Choose a summary..." /></SelectTrigger>
            <SelectContent>
              {summaries.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.original_source?.substring(0, 50) || s.type} — {new Date(s.created_at).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={generateIdeas} disabled={loading} className="animated-gradient text-primary-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Generate Ideas
        </Button>
      </motion.div>

      {ideas.length > 0 && (
        <motion.div variants={cardVariants} className="flex gap-2 flex-wrap">
          <Badge variant={filter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilter("all")}>All</Badge>
          {categories.map((c) => (
            <Badge key={c} variant={filter === c ? "default" : "outline"} className="cursor-pointer capitalize" onClick={() => setFilter(c)}>{c}</Badge>
          ))}
        </motion.div>
      )}

      <motion.div variants={containerVariants} className="grid gap-4 sm:grid-cols-2">
        {filtered.map((idea, i) => (
          <motion.div key={i} variants={cardVariants} whileHover={{ scale: 1.02, boxShadow: "0 0 30px hsl(var(--primary) / 0.15)" }} transition={{ type: "spring", stiffness: 300 }}>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-full">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base">{idea.title}</h3>
                  <Badge className={`text-xs shrink-0 ${impactColors[idea.impact]}`}>{idea.impact}</Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{idea.description}</p>
                <Badge variant="outline" className="text-xs capitalize">{idea.category}</Badge>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
