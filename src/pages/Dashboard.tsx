import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Video, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PDFUpload } from "@/components/PDFUpload";
import { VideoUpload } from "@/components/VideoUpload";
import { SummaryDisplay } from "@/components/SummaryDisplay";
import { VideoSummaryDisplay } from "@/components/VideoSummaryDisplay";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");
  const [videoTranscript, setVideoTranscript] = useState("");
  const [timestamps, setTimestamps] = useState<Array<{ time: string; text: string }>>([]);
  const [contentType, setContentType] = useState<"pdf" | "video">("pdf");
  const { user, canSummarize, refreshUsage } = useAuth();
  const { toast } = useToast();

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url
    ).toString();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n\n";
    }
    return fullText.trim();
  };

  const saveSummary = async (type: "pdf" | "youtube" | "video", source: string, text: string, summaryText: string) => {
    if (!user) return;
    const wordCount = summaryText.split(/\s+/).filter(Boolean).length;
    await supabase.from("summaries").insert({
      user_id: user.id,
      type,
      original_source: source,
      extracted_text: text.substring(0, 50000),
      summary_text: summaryText,
      word_count: wordCount,
    });
    await refreshUsage();
  };

  const handleFileSelect = async (file: File) => {
    if (!canSummarize) {
      toast({ title: "Daily limit reached", description: "Upgrade to Pro for unlimited summaries.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    setFileName(file.name);
    setContentType("pdf");
    try {
      const text = await extractTextFromPDF(file);
      setPdfText(text);
      const { data, error } = await supabase.functions.invoke("summarize-pdf", {
        body: { text, fileName: file.name },
      });
      if (error) throw error;
      setSummary(data.summary);
      await saveSummary("pdf", file.name, text, data.summary);
      toast({ title: "Success!", description: "Your PDF has been summarized." });
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast({ title: "Error", description: "Failed to process PDF.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVideoSelect = async (file: File) => {
    if (!canSummarize) {
      toast({ title: "Daily limit reached", description: "Upgrade to Pro for unlimited summaries.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    setFileName(file.name);
    setContentType("video");
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const { data: tData, error: tErr } = await supabase.functions.invoke("transcribe-video", { body: formData });
      if (tErr) throw tErr;
      setVideoTranscript(tData.text);
      setTimestamps(tData.timestamps || []);
      const { data: sData, error: sErr } = await supabase.functions.invoke("summarize-video", {
        body: { transcript: tData.text, videoName: file.name, timestamps: tData.timestamps },
      });
      if (sErr) throw sErr;
      setSummary(sData.summary);
      await saveSummary("video", file.name, tData.text, sData.summary);
      toast({ title: "Success!", description: "Your video has been summarized." });
    } catch (error) {
      console.error("Error processing video:", error);
      toast({ title: "Error", description: "Failed to process video.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleYouTubeSubmit = async (url: string) => {
    if (!canSummarize) {
      toast({ title: "Daily limit reached", description: "Upgrade to Pro for unlimited summaries.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    setFileName("YouTube Video");
    setContentType("video");
    try {
      const { data: tData, error: tErr } = await supabase.functions.invoke("youtube-transcript", { body: { youtubeUrl: url } });
      if (tErr) throw tErr;
      setVideoTranscript(tData.text);
      setTimestamps(tData.timestamps || []);
      const { data: sData, error: sErr } = await supabase.functions.invoke("summarize-video", {
        body: { transcript: tData.text, videoName: "YouTube Video", timestamps: tData.timestamps },
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
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAskQuestion = async (question: string): Promise<string> => {
    const context = contentType === "pdf" ? pdfText : videoTranscript;
    const { data, error } = await supabase.functions.invoke("answer-question", {
      body: { question, context },
    });
    if (error) throw error;
    return data.answer;
  };

  const handleReset = () => {
    setSummary(null);
    setFileName("");
    setPdfText("");
    setVideoTranscript("");
    setTimestamps([]);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <AnimatePresence mode="wait">
        {!summary ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-8">
              <h1 className="text-3xl font-bold font-display">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Upload a PDF or video to get an AI-powered summary</p>
            </div>

            <div className="glass-card-strong p-8">
              <Tabs defaultValue="pdf" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                  <TabsTrigger value="pdf" className="gap-2 font-display font-semibold">
                    <FileText className="h-4 w-4" />
                    PDF Document
                  </TabsTrigger>
                  <TabsTrigger value="video" className="gap-2 font-display font-semibold">
                    <Video className="h-4 w-4" />
                    Video
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="pdf">
                  <PDFUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
                </TabsContent>
                <TabsContent value="video">
                  <VideoUpload
                    onVideoSelect={handleVideoSelect}
                    onYouTubeSubmit={handleYouTubeSubmit}
                    isProcessing={isProcessing}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="mb-6">
              <Button variant="ghost" onClick={handleReset} className="gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                New Summary
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
