import { useState } from "react";
import { Sparkles, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDFUpload } from "@/components/PDFUpload";
import { SummaryDisplay } from "@/components/SummaryDisplay";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import heroBg from "@/assets/hero-bg.jpg";

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [pdfText, setPdfText] = useState("");
  const { toast } = useToast();

  const extractTextFromPDF = async (file: File): Promise<string> => {
    // For MVP, we'll use a simple text extraction
    // In production, you'd want to use a proper PDF parsing library
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          // Simple extraction - in production use pdf.js or similar
          resolve(text);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
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
                Transform PDFs into
                <span className="block bg-gradient-primary bg-clip-text text-transparent">
                  Actionable Insights
                </span>
              </h2>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Upload any PDF and get instant AI-powered summaries, key insights, and interactive Q&A
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
              <PDFUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              {[
                { icon: Sparkles, title: "AI Summarization", desc: "Get concise summaries of lengthy documents" },
                { icon: MessageSquare, title: "Interactive Q&A", desc: "Ask questions about your document" },
                { icon: FileText, title: "Key Insights", desc: "Extract the most important information" },
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
