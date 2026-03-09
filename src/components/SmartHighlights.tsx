import { useState } from "react";
import { Flame, Loader2, Clock, Zap, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SmartHighlightsProps {
  text: string;
  contentType: "pdf" | "video" | "youtube";
  timestamps?: Array<{ time: string; text: string }>;
  youtubeUrl?: string;
}

interface Highlight {
  timestamp: string;
  description: string;
  importance: "high" | "medium" | "low";
}

const importanceConfig = {
  high: { icon: Flame, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
  medium: { icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  low: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border/50" },
};

export function SmartHighlights({ text, contentType, timestamps, youtubeUrl }: SmartHighlightsProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const { toast } = useToast();

  const isVideo = contentType === "video" || contentType === "youtube";

  const detect = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-highlights", {
        body: { text, contentType, timestamps: timestamps || [] },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      setHighlights(data.highlights || []);
      setIsGenerated(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to detect highlights", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimestampClick = (timestamp: string) => {
    if (!youtubeUrl || !isVideo) return;
    // Parse MM:SS to seconds
    const parts = timestamp.split(":").map(Number);
    let seconds = 0;
    if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];

    const videoId = youtubeUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (videoId) {
      window.open(`https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`, "_blank");
    }
  };

  if (!isGenerated) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="p-4 rounded-full bg-destructive/10">
              <Flame className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-xl font-bold font-display">🔥 Smart Highlights</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              AI detects the most important {isVideo ? "moments in this video" : "sections in this document"}
            </p>
            <Button onClick={detect} disabled={isLoading} variant="outline" className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
              {isLoading ? "Detecting..." : "Detect Key Moments"}
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-6 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-destructive/10">
            <Flame className="h-5 w-5 text-destructive" />
          </div>
          <h2 className="text-xl font-bold font-display">🔥 Key Moments</h2>
          <span className="text-xs text-muted-foreground ml-auto">{highlights.length} highlights</span>
        </div>

        <div className="space-y-3">
          {highlights.map((h, i) => {
            const config = importanceConfig[h.importance] || importanceConfig.medium;
            const Icon = config.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-start gap-3 p-3 rounded-xl border ${config.border} ${config.bg} transition-all`}
              >
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-relaxed">{h.description}</p>
                </div>
                <button
                  onClick={() => handleTimestampClick(h.timestamp)}
                  className={`shrink-0 text-xs font-mono px-2 py-1 rounded-md ${
                    isVideo && youtubeUrl
                      ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {h.timestamp}
                </button>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
