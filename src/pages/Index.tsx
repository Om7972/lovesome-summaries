import { useState, useRef } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { UploadSection } from "@/components/landing/UploadSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { Footer } from "@/components/landing/Footer";
import { SummaryDisplay } from "@/components/SummaryDisplay";
import { VideoSummaryDisplay } from "@/components/VideoSummaryDisplay";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");
  const [videoTranscript, setVideoTranscript] = useState("");
  const [timestamps, setTimestamps] = useState<Array<{ time: string; text: string }>>([]);
  const [contentType, setContentType] = useState<"pdf" | "video">("pdf");
  const uploadRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
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
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      throw new Error("Failed to extract text from PDF.");
    }
  };

  const handleFileSelect = async (file: File) => {
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
      toast({ title: "Success!", description: "Your PDF has been summarized" });
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast({ title: "Error", description: "Failed to process PDF. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAskQuestion = async (question: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("answer-question", {
      body: { question, context: pdfText },
    });
    if (error) throw error;
    return data.answer;
  };

  const handleVideoSelect = async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    setContentType("video");
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke("transcribe-video", { body: formData });
      if (transcriptError) throw transcriptError;
      setVideoTranscript(transcriptData.text);
      setTimestamps(transcriptData.timestamps || []);
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke("summarize-video", {
        body: { transcript: transcriptData.text, videoName: file.name, timestamps: transcriptData.timestamps },
      });
      if (summaryError) throw summaryError;
      setSummary(summaryData.summary);
      toast({ title: "Success!", description: "Your video has been summarized" });
    } catch (error: any) {
      console.error("Error processing video:", error);
      const errorMessage = error?.message || "";
      toast({
        title: "Error",
        description: errorMessage.includes("429") || errorMessage.includes("quota")
          ? "Rate limit exceeded. Please try again in a moment."
          : "Failed to process video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleYouTubeSubmit = async (url: string) => {
    setIsProcessing(true);
    setFileName("YouTube Video");
    setContentType("video");
    try {
      const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke("youtube-transcript", { body: { youtubeUrl: url } });
      if (transcriptError) throw transcriptError;
      setVideoTranscript(transcriptData.text);
      setTimestamps(transcriptData.timestamps || []);
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke("summarize-video", {
        body: { transcript: transcriptData.text, videoName: "YouTube Video", timestamps: transcriptData.timestamps },
      });
      if (summaryError) throw summaryError;
      setSummary(summaryData.summary);
      toast({ title: "Success!", description: "YouTube video has been summarized" });
    } catch (error: any) {
      console.error("Error processing YouTube video:", error);
      const errorMessage = error?.message || "";
      const isCaptionError = errorMessage.includes("captions") || errorMessage.includes("Transcript");
      toast({
        title: "Error",
        description: isCaptionError
          ? "This video doesn't have captions available. Try a different video."
          : "Failed to process YouTube video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAskVideoQuestion = async (question: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("answer-question", {
      body: { question, context: videoTranscript },
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
    <div className="min-h-screen bg-gradient-hero">
      {/* Sticky Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/30 backdrop-blur-xl bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl animated-gradient">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold font-display gradient-text">
                Summarify AI
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            </nav>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {summary && (
                <Button variant="outline" onClick={handleReset} className="glass-card text-sm">
                  New Summary
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {!summary ? (
          <motion.main
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <HeroSection onGetStarted={scrollToUpload} />
            <FeaturesSection />
            <UploadSection
              ref={uploadRef}
              onFileSelect={handleFileSelect}
              onVideoSelect={handleVideoSelect}
              onYouTubeSubmit={handleYouTubeSubmit}
              isProcessing={isProcessing}
            />
            <PricingSection />
            <TestimonialsSection />
            <FAQSection />
            <Footer />
          </motion.main>
        ) : (
          <motion.main
            key="summary"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="container mx-auto px-4 py-12"
          >
            <div className="max-w-7xl mx-auto">
              {contentType === "pdf" ? (
                <SummaryDisplay
                  summary={summary}
                  fileName={fileName}
                  onAskQuestion={handleAskQuestion}
                />
              ) : (
                <VideoSummaryDisplay
                  summary={summary}
                  videoName={fileName}
                  timestamps={timestamps}
                  onAskQuestion={handleAskVideoQuestion}
                />
              )}
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
