import { useState } from "react";
import { Sparkles, FileText, MessageSquare, Video } from "lucide-react";
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");
  const [videoTranscript, setVideoTranscript] = useState("");
  const [timestamps, setTimestamps] = useState<Array<{ time: string; text: string }>>([]);
  const [contentType, setContentType] = useState<"pdf" | "video">("pdf");
  const { toast } = useToast();

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
  };

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);

    try {
      // Extract text from PDF
      const text = await extractTextFromPDF(file);
      setPdfText(text);

      // Call summarization function
      const { data, error } = await supabase.functions.invoke("summarize-pdf", {
        body: { text, fileName: file.name },
      });

      if (error) {
        throw error;
      }

      setSummary(data.summary);
      toast({
        title: "Success!",
        description: "Your PDF has been summarized",
      });
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast({
        title: "Error",
        description: "Failed to process PDF. Please try again.",
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
                Transform Content into
                <span className="block bg-gradient-primary bg-clip-text text-transparent">
                  Actionable Insights
                </span>
              </h2>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Upload PDFs or videos and get instant AI-powered summaries, key insights, and interactive Q&A
              </p>
            </div>

            {/* Upload Section */}
            <div className="relative">
              <div 
                className="absolute inset-0 -z-10 opacity-30 blur-3xl"
                style={{
                  backgroundImage: `url(${heroBg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              
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
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              {[
                { icon: Sparkles, title: "AI Summarization", desc: "Get concise summaries of lengthy content" },
                { icon: MessageSquare, title: "Interactive Q&A", desc: "Ask questions about your content" },
                { icon: Video, title: "Multi-Format Support", desc: "PDFs, videos, and YouTube links" },
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
