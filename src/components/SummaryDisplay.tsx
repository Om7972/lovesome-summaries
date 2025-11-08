import { useState } from "react";
import { FileText, MessageSquare, Sparkles, Send, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface SummaryDisplayProps {
  summary: string;
  fileName: string;
  onAskQuestion: (question: string) => Promise<string>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const SummaryDisplay = ({ summary, fileName, onAskQuestion }: SummaryDisplayProps) => {
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  const handleAskQuestion = async () => {
    if (!question.trim() || isAsking) return;

    const userMessage = question;
    setQuestion("");
    setChatHistory(prev => [...prev, { role: "user", content: userMessage }]);
    setIsAsking(true);

    try {
      const answer = await onAskQuestion(userMessage);
      setChatHistory(prev => [...prev, { role: "assistant", content: answer }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I couldn't process that question. Please try again." 
      }]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  const handleExport = () => {
    const content = `Document: ${fileName}\n\nSummary:\n${summary}\n\n${chatHistory.length > 0 ? '\nQ&A History:\n' + chatHistory.map(msg => `${msg.role === 'user' ? 'Q' : 'A'}: ${msg.content}`).join('\n\n') : ''}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace('.pdf', '')}_summary.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Summary Section */}
      <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">Document Summary</h2>
            <p className="text-sm text-muted-foreground truncate">{fileName}</p>
          </div>
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Sparkles className="h-5 w-5 text-accent" />
        </div>
        
        <ScrollArea className="h-[400px] pr-4">
          <div className="prose prose-sm max-w-none">
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">
              {summary}
            </p>
          </div>
        </ScrollArea>
      </Card>

      {/* Q&A Section */}
      <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-accent/10">
            <MessageSquare className="h-5 w-5 text-accent" />
          </div>
          <h2 className="text-xl font-bold">Ask Questions</h2>
        </div>

        <ScrollArea className="h-[300px] mb-4 pr-4">
          {chatHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Ask me anything about this document
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {chatHistory.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              {isAsking && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <Separator className="mb-4" />

        <div className="flex gap-2">
          <Input
            placeholder="Ask about the document..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isAsking}
            className="flex-1"
          />
          <Button
            onClick={handleAskQuestion}
            disabled={!question.trim() || isAsking}
            size="icon"
            className="shrink-0"
          >
            {isAsking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};
