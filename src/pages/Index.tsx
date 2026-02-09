import { useState } from "react";
import { Sparkles, FileText, MessageSquare, Youtube, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDFUpload } from "@/components/PDFUpload";
import { VideoUpload } from "@/components/VideoUpload";
import { SummaryDisplay } from "@/components/SummaryDisplay";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import heroBg from "@/assets/hero-bg.jpg";

const Index = () => {
  const [activeTab, setActiveTab] = useState<"pdf" | "video">("pdf");
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");
  const { toast } = useToast();

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);

    try {
      // Convert PDF to base64
      const pdfBase64 = await fileToBase64(file);
      
      // Also try to extract text using pdf.js for better results
      let extractedText = "";
      try {
        // Try using pdf.js if available, otherwise let the edge function handle it
        // For now, we'll let the edge function extract text from the base64 PDF
      } catch (error) {
        console.log("Text extraction will be handled by edge function");
      }

      // Call summarization function with base64 PDF
      const { data, error } = await supabase.functions.invoke("summarize-pdf", {
        body: { 
          pdfBase64,
          fileName: file.name,
          text: extractedText || undefined, // Optional: pass extracted text if available
        },
      });

      // Check for Supabase function invocation error
      if (error) {
        console.error("Supabase function error:", error);
        throw new Error(error.message || "Failed to invoke summarization function");
      }

      // Check for error in response data
      if (data && data.error) {
        console.error("Function returned error:", data.error);
        throw new Error(data.error);
      }

      // Validate response
      if (!data || !data.summary) {
        throw new Error("No summary received from server");
      }

      setSummary(data.summary);
      // Store the extracted text for Q&A
      setPdfText(data.extractedText || extractedText || "");
      
      toast({
        title: "Success!",
        description: "Your PDF has been summarized successfully",
      });
    } catch (error: any) {
      console.error("Error processing PDF:", error);
      const errorMessage = error?.message || error?.error?.message || "Failed to process PDF. Please ensure the PDF contains readable text and try again.";
      toast({
        title: "Error Processing PDF",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVideoSubmit = async (videoSource: string, type: "youtube" | "upload") => {
    setIsProcessing(true);
    setFileName(type === "youtube" ? "YouTube Video" : "Uploaded Video");

    try {
      let videoBase64: string | undefined;
      let videoUrl: string | undefined;

      if (type === "youtube") {
        // For YouTube videos, pass the URL
        videoUrl = videoSource;
      } else {
        // For uploaded videos, convert to base64
        try {
          // If videoSource is a blob URL, we need to fetch it first
          if (videoSource.startsWith('blob:')) {
            const response = await fetch(videoSource);
            const blob = await response.blob();
            const file = new File([blob], 'video.mp4', { type: blob.type });
            videoBase64 = await fileToBase64(file);
          } else {
            // If it's already a file, convert it
            // This shouldn't happen with current implementation, but handle it just in case
            videoUrl = videoSource;
          }
        } catch (error) {
          console.error("Error processing video file:", error);
          throw new Error("Failed to process video file. Please try again.");
        }
      }

      // Step 1: Transcribe the video
      const { data: transcriptionData, error: transcriptionError } = await supabase.functions.invoke("transcribe-video", {
        body: { 
          videoUrl,
          videoBase64,
          videoType: type,
        },
      });

      // Check for Supabase function invocation error
      if (transcriptionError) {
        console.error("Transcription function error:", transcriptionError);
        throw new Error(transcriptionError.message || "Failed to invoke transcription function");
      }

      // Check for error in response data
      if (transcriptionData && transcriptionData.error) {
        console.error("Transcription returned error:", transcriptionData.error);
        throw new Error(transcriptionData.error);
      }

      // Validate transcription response
      if (!transcriptionData || !transcriptionData.transcription) {
        throw new Error("No transcription received from server");
      }

      // Store transcription for potential Q&A
      const transcription = transcriptionData.transcription;
      setPdfText(transcription);

      // Step 2: Summarize the transcription
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke("summarize-video", {
        body: { 
          transcription,
          videoUrl: videoUrl || videoSource,
        },
      });

      // Check for Supabase function invocation error
      if (summaryError) {
        console.error("Summarization function error:", summaryError);
        throw new Error(summaryError.message || "Failed to invoke summarization function");
      }

      // Check for error in response data
      if (summaryData && summaryData.error) {
        console.error("Summarization returned error:", summaryData.error);
        throw new Error(summaryData.error);
      }

      // Validate summary response
      if (!summaryData || !summaryData.summary) {
        throw new Error("No summary received from server");
      }

      setSummary(summaryData.summary);
      toast({
        title: "Success!",
        description: "Your video has been processed and summarized successfully",
      });
    } catch (error: any) {
      console.error("Error processing video:", error);
      const errorMessage = error?.message || error?.error?.message || "Failed to process video. Please ensure the video has audio and try again.";
      toast({
        title: "Error Processing Video",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAskQuestion = async (question: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke("answer-question", {
        body: { question, context: pdfText },
      });

      if (error) {
        throw error;
      }

      return data.answer;
    } catch (error) {
      console.error("Error answering question:", error);
      throw error;
    }
  };

  const handleReset = () => {
    setSummary(null);
    setFileName("");
    setPdfText("");
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <FileText className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Lovable Summarize
              </h1>
            </div>
            {summary && (
              <Button variant="outline" onClick={handleReset}>
                New Document
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {!summary ? (
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">AI-Powered Insights</span>
              </div>
              
              <h2 className="text-5xl font-bold tracking-tight">
                Transform Documents & Videos into
                <span className="block bg-gradient-primary bg-clip-text text-transparent">
                  Actionable Insights
                </span>
              </h2>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Upload PDFs or YouTube videos and get instant AI-powered summaries, key insights, and interactive Q&A
              </p>
            </div>

            {/* Document Type Selector */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex rounded-lg border border-border bg-muted p-1">
                <Button
                  variant={activeTab === "pdf" ? "default" : "ghost"}
                  className="flex items-center gap-2"
                  onClick={() => setActiveTab("pdf")}
                >
                  <FileText className="h-4 w-4" />
                  PDF Document
                </Button>
                <Button
                  variant={activeTab === "video" ? "default" : "ghost"}
                  className="flex items-center gap-2"
                  onClick={() => setActiveTab("video")}
                >
                  <Youtube className="h-4 w-4" />
                  Video Content
                </Button>
              </div>
            </div>

            {/* Upload Section */}
            <div className="relative">
              <div 
                className="absolute inset-0 -z-10 opacity-30 blur-3xl hero-bg"
                style={{
                  backgroundImage: `url(${heroBg})`,
                }}
              />
              {activeTab === "pdf" ? (
                <PDFUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
              ) : (
                <VideoUpload onVideoSubmit={handleVideoSubmit} isProcessing={isProcessing} />
              )}
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              {[
                { icon: Sparkles, title: "AI Summarization", desc: "Get concise summaries of documents and videos" },
                { icon: MessageSquare, title: "Interactive Q&A", desc: "Ask questions about your content" },
                { icon: Film, title: "Video Processing", desc: "Transcribe and summarize YouTube videos" },
              ].map((feature, i) => (
                <div key={i} className="p-6 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all">
                  <div className="p-2 rounded-lg bg-primary/10 w-fit mb-4">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <SummaryDisplay
              summary={summary}
              fileName={fileName}
              onAskQuestion={handleAskQuestion}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;