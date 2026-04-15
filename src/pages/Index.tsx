import { useState } from "react";
<<<<<<< HEAD
import { Sparkles, FileText, MessageSquare, Youtube, Film } from "lucide-react";
=======
import { Sparkles, FileText, MessageSquare, Video } from "lucide-react";
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PDFUpload } from "@/components/PDFUpload";
import { VideoUpload } from "@/components/VideoUpload";
import { SummaryDisplay } from "@/components/SummaryDisplay";
import { VideoSummaryDisplay } from "@/components/VideoSummaryDisplay";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import heroBg from "@/assets/hero-bg.jpg";

const Index = () => {
  const [activeTab, setActiveTab] = useState<"pdf" | "video">("pdf");
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");
  const [videoTranscript, setVideoTranscript] = useState("");
  const [timestamps, setTimestamps] = useState<Array<{ time: string; text: string }>>([]);
  const [contentType, setContentType] = useState<"pdf" | "video">("pdf");
  const { toast } = useToast();

<<<<<<< HEAD
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
=======
  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker source using Vite's URL constructor for local worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
      ).toString();
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error('Failed to extract text from PDF. Please ensure the file is a valid PDF.');
    }
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
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

  const handleVideoSelect = async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    setContentType("video");

    try {
      // Create form data for video transcription
      const formData = new FormData();
      formData.append('audio', file);

      // Call transcription function
      const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke(
        "transcribe-video",
        {
          body: formData,
        }
      );

      if (transcriptError) throw transcriptError;

      setVideoTranscript(transcriptData.text);
      setTimestamps(transcriptData.timestamps || []);

      // Call summarization function
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke(
        "summarize-video",
        {
          body: {
            transcript: transcriptData.text,
            videoName: file.name,
            timestamps: transcriptData.timestamps,
          },
        }
      );

      if (summaryError) throw summaryError;

      setSummary(summaryData.summary);
      toast({
        title: "Success!",
        description: "Your video has been summarized",
      });
    } catch (error: any) {
      console.error("Error processing video:", error);
      
      // Check if it's an OpenAI quota error
      const errorMessage = error?.message || '';
      const isQuotaError = errorMessage.includes('429') || errorMessage.includes('quota');
      
      toast({
        title: "Error",
        description: isQuotaError 
          ? "OpenAI API quota exceeded. Please add credits to your OpenAI account or contact support." 
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
      // Call YouTube transcript function
      const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke(
        "youtube-transcript",
        {
          body: { youtubeUrl: url },
        }
      );

      if (transcriptError) throw transcriptError;

      setVideoTranscript(transcriptData.text);
      setTimestamps(transcriptData.timestamps || []);

      // Call summarization function
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke(
        "summarize-video",
        {
          body: {
            transcript: transcriptData.text,
            videoName: "YouTube Video",
            timestamps: transcriptData.timestamps,
          },
        }
      );

      if (summaryError) throw summaryError;

      setSummary(summaryData.summary);
      toast({
        title: "Success!",
        description: "YouTube video has been summarized",
      });
    } catch (error: any) {
      console.error("Error processing YouTube video:", error);
      
      const errorMessage = error?.message || '';
      const isQuotaError = errorMessage.includes('429') || errorMessage.includes('quota');
      const isCaptionError = errorMessage.includes('captions') || errorMessage.includes('Transcript');
      
      toast({
        title: "Error",
        description: isQuotaError
          ? "OpenAI API quota exceeded. Please add credits to your OpenAI account."
          : isCaptionError
          ? "This video doesn't have captions available. Try a different video or upload the video file directly."
          : "Failed to process YouTube video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAskVideoQuestion = async (question: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke("answer-question", {
        body: { question, context: videoTranscript },
      });

      if (error) throw error;
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
    setVideoTranscript("");
    setTimestamps([]);
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
<<<<<<< HEAD
                Transform Documents & Videos into
=======
                Transform Content into
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
                <span className="block bg-gradient-primary bg-clip-text text-transparent">
                  Actionable Insights
                </span>
              </h2>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
<<<<<<< HEAD
                Upload PDFs or YouTube videos and get instant AI-powered summaries, key insights, and interactive Q&A
=======
                Upload PDFs or videos and get instant AI-powered summaries, key insights, and interactive Q&A
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
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
<<<<<<< HEAD
              {activeTab === "pdf" ? (
                <PDFUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
              ) : (
                <VideoUpload onVideoSubmit={handleVideoSubmit} isProcessing={isProcessing} />
              )}
=======
              
              <Tabs defaultValue="pdf" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="pdf" className="gap-2">
                    <FileText className="h-4 w-4" />
                    PDF Document
                  </TabsTrigger>
                  <TabsTrigger value="video" className="gap-2">
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
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              {[
<<<<<<< HEAD
                { icon: Sparkles, title: "AI Summarization", desc: "Get concise summaries of documents and videos" },
                { icon: MessageSquare, title: "Interactive Q&A", desc: "Ask questions about your content" },
                { icon: Film, title: "Video Processing", desc: "Transcribe and summarize YouTube videos" },
=======
                { icon: Sparkles, title: "AI Summarization", desc: "Get concise summaries of lengthy content" },
                { icon: MessageSquare, title: "Interactive Q&A", desc: "Ask questions about your content" },
                { icon: Video, title: "Multi-Format Support", desc: "PDFs, videos, and YouTube links" },
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
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
        )}
      </main>
    </div>
  );
};

export default Index;