import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Presentation, Loader2, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Slide {
  title: string;
  bullets: string[];
  notes?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function SlideGeneratorPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<any[]>([]);
  const [selectedSummary, setSelectedSummary] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);

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
      const { data: s } = await supabase.from("summaries").select("summary_text, key_points").eq("id", selectedSummary).single();
      if (!s) throw new Error("Not found");

      const prompt = `Convert this summary into presentation slides (8-12 slides). Summary: ${s.summary_text?.substring(0, 3000)}. Key points: ${JSON.stringify(s.key_points)}.\n\nReturn JSON array: [{"title":"Slide Title","bullets":["point 1","point 2","point 3"],"notes":"speaker notes"}]. Include a title slide, agenda, content slides, and conclusion.`;

      const { data: aiData, error } = await supabase.functions.invoke("answer-question", { body: { question: prompt, context: "" } });
      if (error) throw error;
      const match = (aiData?.answer || "").match(/\[[\s\S]*\]/);
      if (match) { setSlides(JSON.parse(match[0])); setCurrent(0); }
      else toast.error("Could not parse slides");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const slide = slides[current];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 max-w-5xl mx-auto">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Presentation className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display gradient-text">Slide Generator</h1>
            <p className="text-muted-foreground text-sm">Convert summaries into presentation slides</p>
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
          Generate Slides
        </Button>
      </motion.div>

      {slide && (
        <motion.div variants={itemVariants} className="space-y-4">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 min-h-[320px] flex flex-col justify-center">
              <motion.div key={current} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                <p className="text-xs text-muted-foreground mb-2">Slide {current + 1} of {slides.length}</p>
                <h2 className="text-2xl font-bold font-display mb-6">{slide.title}</h2>
                <ul className="space-y-3">
                  {slide.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <span className="text-sm leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
            {slide.notes && (
              <CardContent className="p-4 border-t border-border/30">
                <p className="text-xs text-muted-foreground"><span className="font-medium">Speaker Notes:</span> {slide.notes}</p>
              </CardContent>
            )}
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setCurrent((p) => Math.max(0, p - 1))} disabled={current === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <div className="flex gap-1">
              {slides.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)} className={`h-2 w-2 rounded-full transition-all ${i === current ? "bg-primary w-6" : "bg-muted-foreground/30"}`} />
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setCurrent((p) => Math.min(slides.length - 1, p + 1))} disabled={current === slides.length - 1}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
