import { useState, useRef } from "react";
import { Headphones, Play, Pause, Download, Loader2, Volume2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PodcastPlayerProps {
  summary: string;
}

const VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", desc: "Male, professional" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "Female, warm" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", desc: "Male, authoritative" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", desc: "Female, clear" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", desc: "Male, conversational" },
];

export function PodcastPlayer({ summary }: PodcastPlayerProps) {
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const generate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-podcast", {
        body: { text: summary, voiceId: selectedVoice },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      const url = `data:audio/mpeg;base64,${data.audioContent}`;
      setAudioUrl(url);
      toast({ title: "🎧 Podcast Ready!", description: "Your audio summary is ready to play." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate podcast", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = "summary-podcast.mp3";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Downloaded!", description: "Podcast saved as MP3." });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-6 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Headphones className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display">🎧 Listen to Summary</h2>
            <p className="text-xs text-muted-foreground">Convert your summary to an AI podcast</p>
          </div>
        </div>

        {!audioUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground shrink-0">Voice:</span>
              <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isGenerating}>
                <SelectTrigger className="w-[200px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICES.map(v => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      {v.name} — {v.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generate} disabled={isGenerating} className="w-full animated-gradient text-primary-foreground btn-glow gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
              {isGenerating ? "Generating Audio..." : "Generate Podcast"}
            </Button>
            {isGenerating && (
              <p className="text-xs text-muted-foreground text-center">This may take 10-30 seconds...</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
            />
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
              <Button
                onClick={togglePlay}
                size="icon"
                className="h-12 w-12 rounded-full animated-gradient text-primary-foreground btn-glow"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>
              <div className="flex-1">
                <p className="text-sm font-semibold">Summary Podcast</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Volume2 className="h-3 w-3" /> {VOICES.find(v => v.id === selectedVoice)?.name}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> MP3
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setAudioUrl(null); setIsPlaying(false); }} className="text-xs text-muted-foreground">
              Generate with different voice
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
