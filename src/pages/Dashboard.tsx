import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Video, ArrowLeft, Youtube, Clock, BarChart3, Zap, TrendingUp,
  Sparkles, Search, Filter, Trash2, Eye, Loader2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { PDFUpload } from "@/components/PDFUpload";
import { VideoUpload } from "@/components/VideoUpload";
import { SummaryDisplay } from "@/components/SummaryDisplay";
import { VideoSummaryDisplay } from "@/components/VideoSummaryDisplay";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Summary {
  id: string;
  type: string;
  original_source: string;
  summary_text: string;
  word_count: number;
  created_at: string;
}

const typeIcons: Record<string, any> = { pdf: FileText, video: Video, youtube: Youtube };

export default function Dashboard() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");
  const [videoTranscript, setVideoTranscript] = useState("");
  const [timestamps, setTimestamps] = useState<Array<{ time: string; text: string }>>([]);
  const [contentType, setContentType] = useState<"pdf" | "video">("pdf");
  const [summaryLength, setSummaryLength] = useState<"short" | "medium" | "detailed">("medium");

  // History state
  const [recentSummaries, setRecentSummaries] = useState<Summary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewSummary, setViewSummary] = useState<Summary | null>(null);

  const { user, profile, canSummarize, todaySummaryCount, refreshUsage } = useAuth();
  const { toast } = useToast();

  const FREE_LIMIT = 5;

  // Fetch recent summaries
  const fetchRecentSummaries = async () => {
    if (!user) return;
    setHistoryLoading(true);
    let query = supabase
      .from("summaries")
      .select("id, type, original_source, summary_text, word_count, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (historyFilter !== "all") query = query.eq("type", historyFilter);
    const { data } = await query;
    setRecentSummaries((data as Summary[]) || []);
    setHistoryLoading(false);
  };

  useEffect(() => { fetchRecentSummaries(); }, [user, historyFilter]);

  // Stats
  const totalSummaries = recentSummaries.length;
  const pdfCount = recentSummaries.filter(s => s.type === "pdf").length;
  const ytCount = recentSummaries.filter(s => s.type === "youtube").length;
  const avgWordCount = totalSummaries > 0 ? Math.round(recentSummaries.reduce((a, s) => a + s.word_count, 0) / totalSummaries) : 0;
  const timeSaved = Math.round(recentSummaries.reduce((a, s) => a + s.word_count, 0) / 200); // minutes

  const filteredSummaries = recentSummaries.filter(s =>
    searchQuery ? s.original_source.toLowerCase().includes(searchQuery.toLowerCase()) || s.summary_text.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const readingTime = (wc: number) => Math.max(1, Math.ceil(wc / 200));

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("summaries").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    } else {
      setRecentSummaries(prev => prev.filter(s => s.id !== id));
      toast({ title: "Deleted", description: "Summary removed." });
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n\n";
    }
    return fullText.trim();
  };

  const saveSummary = async (type: "pdf" | "youtube" | "video", source: string, text: string, summaryText: string) => {
    if (!user) return;
    const wordCount = summaryText.split(/\s+/).filter(Boolean).length;
    await supabase.from("summaries").insert({
      user_id: user.id, type, original_source: source,
      extracted_text: text.substring(0, 50000), summary_text: summaryText, word_count: wordCount,
    });
    await refreshUsage();
    await fetchRecentSummaries();
  };

  const handleFileSelect = async (file: File) => {
    if (!canSummarize) { toast({ title: "Daily limit reached", description: "Upgrade to Pro for unlimited summaries.", variant: "destructive" }); return; }
    setIsProcessing(true); setFileName(file.name); setContentType("pdf");
    try {
      const text = await extractTextFromPDF(file);
      setPdfText(text);
      const { data, error } = await supabase.functions.invoke("summarize-pdf", { body: { text, fileName: file.name, length: summaryLength } });
      if (error) throw error;
      setSummary(data.summary);
      await saveSummary("pdf", file.name, text, data.summary);
      toast({ title: "Success!", description: "Your PDF has been summarized." });
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast({ title: "Error", description: "Failed to process PDF.", variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  const handleVideoSelect = async (file: File) => {
    if (!canSummarize) { toast({ title: "Daily limit reached", description: "Upgrade to Pro for unlimited summaries.", variant: "destructive" }); return; }
    setIsProcessing(true); setFileName(file.name); setContentType("video");
    try {
      const formData = new FormData(); formData.append("audio", file);
      const { data: tData, error: tErr } = await supabase.functions.invoke("transcribe-video", { body: formData });
      if (tErr) throw tErr;
      setVideoTranscript(tData.text); setTimestamps(tData.timestamps || []);
      const { data: sData, error: sErr } = await supabase.functions.invoke("summarize-video", {
        body: { transcript: tData.text, videoName: file.name, timestamps: tData.timestamps, length: summaryLength },
      });
      if (sErr) throw sErr;
      setSummary(sData.summary);
      await saveSummary("video", file.name, tData.text, sData.summary);
      toast({ title: "Success!", description: "Your video has been summarized." });
    } catch (error) {
      console.error("Error processing video:", error);
      toast({ title: "Error", description: "Failed to process video.", variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  const handleYouTubeSubmit = async (url: string) => {
    if (!canSummarize) { toast({ title: "Daily limit reached", description: "Upgrade to Pro for unlimited summaries.", variant: "destructive" }); return; }
    setIsProcessing(true); setFileName("YouTube Video"); setContentType("video");
    try {
      const { data: tData, error: tErr } = await supabase.functions.invoke("youtube-transcript", { body: { youtubeUrl: url } });
      if (tErr) throw tErr;
      setVideoTranscript(tData.text); setTimestamps(tData.timestamps || []);
      const { data: sData, error: sErr } = await supabase.functions.invoke("summarize-video", {
        body: { transcript: tData.text, videoName: "YouTube Video", timestamps: tData.timestamps, length: summaryLength },
      });
      if (sErr) throw sErr;
      setSummary(sData.summary);
      await saveSummary("youtube", url, tData.text, sData.summary);
      toast({ title: "Success!", description: "YouTube video has been summarized." });
    } catch (error: any) {
      console.error("Error processing YouTube:", error);
      const msg = error?.message || "";
      toast({
        title: "Error",
        description: msg.includes("captions") ? "This video doesn't have captions available." : "Failed to process YouTube video.",
        variant: "destructive",
      });
    } finally { setIsProcessing(false); }
  };

  const handleAskQuestion = async (question: string): Promise<string> => {
    const context = contentType === "pdf" ? pdfText : videoTranscript;
    const { data, error } = await supabase.functions.invoke("answer-question", { body: { question, context } });
    if (error) throw error;
    return data.answer;
  };

  const handleReset = () => {
    setSummary(null); setFileName(""); setPdfText(""); setVideoTranscript(""); setTimestamps([]);
  };

  const statsCards = [
    { label: "Total Summaries", value: totalSummaries, icon: BarChart3, color: "text-primary" },
    { label: "YouTube Summaries", value: ytCount, icon: Youtube, color: "text-red-500" },
    { label: "PDF Summaries", value: pdfCount, icon: FileText, color: "text-blue-500" },
    { label: "Time Saved", value: `${timeSaved}m`, icon: Clock, color: "text-green-500" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <AnimatePresence mode="wait">
        {!summary ? (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold font-display">
                  Welcome back, <span className="gradient-text">{profile?.full_name || "there"}</span>
                </h1>
                <p className="text-muted-foreground mt-1">
                  {todaySummaryCount} summaries today · {totalSummaries} total
                </p>
              </div>
              {/* Usage Limit */}
              {!profile?.is_premium && (
                <div className="glass-card p-4 min-w-[240px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Daily Usage</span>
                    <span className="text-xs font-semibold">{todaySummaryCount}/{FREE_LIMIT}</span>
                  </div>
                  <Progress value={(todaySummaryCount / FREE_LIMIT) * 100} className="h-2 mb-2" />
                  {!canSummarize ? (
                    <Button asChild size="sm" className="w-full animated-gradient text-primary-foreground text-xs mt-1">
                      <Link to="/pricing">
                        <Sparkles className="h-3 w-3 mr-1" /> Upgrade to Pro
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">{FREE_LIMIT - todaySummaryCount} summaries remaining</p>
                  )}
                </div>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {statsCards.map((stat, i) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <Card className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg bg-muted/50 ${stat.color}`}>
                        <stat.icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                    </div>
                    <p className="text-2xl font-bold font-display">{stat.value}</p>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Upload Section */}
            <div className="glass-card-strong p-8 mb-8">
              {/* Summary Length Selector */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-sm font-medium text-muted-foreground">Summary Length:</span>
                {(["short", "medium", "detailed"] as const).map(len => (
                  <Button
                    key={len}
                    variant={summaryLength === len ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSummaryLength(len)}
                    className="capitalize text-xs"
                  >
                    {len}
                  </Button>
                ))}
              </div>

              <Tabs defaultValue="pdf" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                  <TabsTrigger value="pdf" className="gap-2 font-display font-semibold">
                    <FileText className="h-4 w-4" /> PDF Document
                  </TabsTrigger>
                  <TabsTrigger value="video" className="gap-2 font-display font-semibold">
                    <Video className="h-4 w-4" /> Video
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="pdf">
                  <PDFUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
                </TabsContent>
                <TabsContent value="video">
                  <VideoUpload onVideoSelect={handleVideoSelect} onYouTubeSubmit={handleYouTubeSubmit} isProcessing={isProcessing} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Recent History */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h2 className="text-xl font-bold font-display">Recent Summaries</h2>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 h-8 text-xs w-40"
                    />
                  </div>
                  {["all", "pdf", "youtube", "video"].map(f => (
                    <Button key={f} variant={historyFilter === f ? "default" : "outline"} size="sm" onClick={() => setHistoryFilter(f)} className="capitalize text-xs h-8">
                      {f}
                    </Button>
                  ))}
                </div>
              </div>

              {historyLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="glass-card p-5 flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : filteredSummaries.length === 0 ? (
                <Card className="glass-card p-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No matching summaries found." : "No summaries yet. Create your first one above!"}
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredSummaries.slice(0, 10).map((item, idx) => {
                    const Icon = typeIcons[item.type] || FileText;
                    return (
                      <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                        <Card className="glass-card p-4 flex items-center gap-4 group hover:border-primary/30 transition-all">
                          <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{item.original_source || "Untitled"}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="capitalize bg-muted px-2 py-0.5 rounded">{item.type}</span>
                              <span>{item.word_count} words</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{readingTime(item.word_count)}m</span>
                              <span>{new Date(item.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewSummary(item)}><Eye className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                  {filteredSummaries.length > 10 && (
                    <div className="text-center pt-2">
                      <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground">
                        <Link to="/history">View all summaries →</Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

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
          </motion.div>
        ) : (
          <motion.div key="summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mb-6">
              <Button variant="ghost" onClick={handleReset} className="gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> New Summary
              </Button>
            </div>
            {contentType === "pdf" ? (
              <SummaryDisplay summary={summary} fileName={fileName} onAskQuestion={handleAskQuestion} />
            ) : (
              <VideoSummaryDisplay summary={summary} videoName={fileName} timestamps={timestamps} onAskQuestion={handleAskQuestion} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
