import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface TimelineEvent {
  time: string;
  topic: string;
  summary: string;
  importance: "high" | "medium" | "low";
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

const dotColors: Record<string, string> = {
  high: "bg-destructive",
  medium: "bg-primary",
  low: "bg-muted-foreground",
};

export default function TimelineViewerPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<any[]>([]);
  const [selectedSummary, setSelectedSummary] = useState("");
  const [events, setEvents] = useState<TimelineEvent[]>([]);
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

  const generate = async () => {
    if (!selectedSummary) { toast.error("Select a summary"); return; }
    setLoading(true);
    try {
      const { data: s } = await supabase.from("summaries").select("summary_text, key_points, type").eq("id", selectedSummary).single();
      if (!s) throw new Error("Not found");

      const prompt = `Create a chronological timeline of topics discussed in this content. Content: ${s.summary_text?.substring(0, 3000)}.\n\nReturn JSON array: [{"time":"0:00-2:30","topic":"Introduction","summary":"Brief description","importance":"high|medium|low"}]. Create 8-15 timeline entries.`;

      const { data: aiData, error } = await supabase.functions.invoke("answer-question", { body: { question: prompt, context: "" } });
      if (error) throw error;
      const match = (aiData?.answer || "").match(/\[[\s\S]*\]/);
      if (match) setEvents(JSON.parse(match[0]));
      else toast.error("Could not parse timeline");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === "all" ? events : events.filter((e) => e.importance === filter);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 max-w-4xl mx-auto">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display gradient-text">Timeline Viewer</h1>
            <p className="text-muted-foreground text-sm">Visual timeline of topics discussed</p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-wrap gap-3 items-end">
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
        <Button onClick={generate} disabled={loading} className="animated-gradient text-primary-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Generate Timeline
        </Button>
      </motion.div>

      {events.length > 0 && (
        <motion.div variants={itemVariants} className="flex gap-2">
          {["all", "high", "medium", "low"].map((level) => (
            <Badge key={level} variant={filter === level ? "default" : "outline"} className="cursor-pointer capitalize" onClick={() => setFilter(level)}>
              {level}
            </Badge>
          ))}
        </motion.div>
      )}

      {filtered.length > 0 && (
        <motion.div variants={containerVariants} className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
          {filtered.map((event, i) => (
            <motion.div key={i} variants={itemVariants} className="relative mb-6 last:mb-0" whileHover={{ x: 4 }}>
              <div className={`absolute -left-5 top-2 h-3 w-3 rounded-full ring-4 ring-background ${dotColors[event.importance]}`} />
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-glow transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs font-mono">{event.time}</Badge>
                    <Badge className={`text-xs ${event.importance === "high" ? "bg-destructive/10 text-destructive" : event.importance === "medium" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{event.importance}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm">{event.topic}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{event.summary}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
