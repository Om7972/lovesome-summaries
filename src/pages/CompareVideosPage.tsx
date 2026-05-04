import { useState } from "react";
import { motion } from "framer-motion";
import { GitCompareArrows, Plus, Trash2, Loader2, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface ComparisonResult {
  criteria: string;
  videos: Record<string, string>;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function CompareVideosPage() {
  const { user } = useAuth();
  const [urls, setUrls] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [videoTitles, setVideoTitles] = useState<string[]>([]);

  const addUrl = () => setUrls((prev) => [...prev, ""]);
  const removeUrl = (i: number) => setUrls((prev) => prev.filter((_, idx) => idx !== i));
  const updateUrl = (i: number, val: string) =>
    setUrls((prev) => prev.map((u, idx) => (idx === i ? val : u)));

  const handleCompare = async () => {
    const validUrls = urls.filter((u) => u.trim());
    if (validUrls.length < 2) {
      toast.error("Please enter at least 2 YouTube URLs");
      return;
    }
    setLoading(true);
    try {
      const transcripts: string[] = [];
      const titles: string[] = [];
      for (const url of validUrls) {
        const { data, error } = await supabase.functions.invoke("youtube-transcript", {
          body: { youtubeUrl: url, userId: user?.id },
        });
        if (error || !data?.success) {
          const msg = data?.message || `Failed to fetch transcript for: ${url}`;
          toast.error(msg);
          setLoading(false);
          return;
        }
        const transcriptText: string = data.text || "";
        if (!transcriptText.trim()) {
          toast.error(`No transcript content for: ${url}`);
          setLoading(false);
          return;
        }
        transcripts.push(transcriptText.substring(0, 3000));
        const vid = data.videoId ? ` (${data.videoId})` : "";
        titles.push(`Video${vid}`);
      }
      setVideoTitles(titles);

      const prompt = `Compare these ${transcripts.length} videos side by side. For each video I'll give you a transcript excerpt.\n\n${transcripts.map((t, i) => `Video ${i + 1} ("${titles[i]}"): ${t}`).join("\n\n")}\n\nReturn a JSON array of comparison criteria objects like: [{"criteria":"Topic","videos":{"Video 1":"...","Video 2":"..."}}]. Include at least 6 criteria: Topic, Key Arguments, Tone, Target Audience, Strengths, Weaknesses.`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke("answer-question", {
        body: { question: prompt, context: "" },
      });

      if (aiError) throw aiError;
      const text = aiData?.answer || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        setResults(JSON.parse(jsonMatch[0]));
      } else {
        toast.error("Could not parse comparison results");
      }
    } catch (e: any) {
      toast.error(e.message || "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8 max-w-6xl mx-auto">
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
            <GitCompareArrows className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display gradient-text">Compare Videos</h1>
            <p className="text-muted-foreground text-sm">AI-powered side-by-side video comparison</p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Youtube className="h-5 w-5 text-destructive" /> YouTube URLs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {urls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => updateUrl(i, e.target.value)}
                  placeholder={`Video ${i + 1} URL`}
                  className="flex-1"
                />
                {urls.length > 2 && (
                  <Button variant="ghost" size="icon" onClick={() => removeUrl(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addUrl}>
                <Plus className="h-4 w-4 mr-1" /> Add Video
              </Button>
              <Button onClick={handleCompare} disabled={loading} className="animated-gradient text-primary-foreground">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitCompareArrows className="h-4 w-4 mr-2" />}
                Compare
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {results.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Comparison Results</CardTitle>
              <div className="flex gap-2 flex-wrap">
                {videoTitles.map((t, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Criteria</TableHead>
                    {videoTitles.map((t, i) => (
                      <TableHead key={i}>{t}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.criteria}</TableCell>
                      {videoTitles.map((_, vi) => (
                        <TableCell key={vi}>{row.videos[`Video ${vi + 1}`] || "-"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
