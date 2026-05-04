import { useState } from "react";
import { FileText, MessageSquare, Sparkles, Send, Loader2, Download, Copy, Check, ChevronDown, Clock, BarChart3, Youtube, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface SummaryDisplayProps {
  summary: string;
  fileName: string;
  onAskQuestion: (question: string) => Promise<string>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface TimestampedContent {
  timestamp: string;
  content: string;
}

export const SummaryDisplay = ({ summary, fileName, onAskQuestion }: SummaryDisplayProps) => {
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const wordCount = summary.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const sections = summary.split(/\n{2,}/).filter((s) => s.trim());
  const isLong = sections.length > 3;

  const isVideoSummary = summary.includes("[00:") || /\[\d{1,2}:\d{2}/.test(summary);
  const parseTimestampedContent = (text: string): TimestampedContent[] => {
    const out: TimestampedContent[] = [];
    text.split("\n").forEach((line) => {
      const m = line.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
      if (m) {
        out.push({ timestamp: m[1], content: line.replace(m[0], "").trim() });
      }
    });
    return out;
  };
  const timestampedContent = isVideoSummary ? parseTimestampedContent(summary) : [];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    toast({ title: "Copied!", description: "Summary copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const content = `Document: ${fileName}\n\nSummary:\n${summary}\n\n${
      chatHistory.length > 0
        ? "\nQ&A History:\n" + chatHistory.map((m) => `${m.role === "user" ? "Q" : "A"}: ${m.content}`).join("\n\n")
        : ""
    }`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\.[^/.]+$/, "")}_summary.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded!", description: "Summary saved as TXT file." });
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || isAsking) return;
    const userMessage = question;
    setQuestion("");
    setChatHistory((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsAsking(true);
    try {
      const answer = await onAskQuestion(userMessage);
      setChatHistory((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setChatHistory((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that question. Please try again." }]);
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

  const isVideoLike = fileName.includes("Video") || fileName.includes("YouTube");

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Summary Section */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              {isVideoLike ? <Youtube className="h-5 w-5 text-destructive" /> : <FileText className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold font-display">Content Summary</h2>
              <p className="text-sm text-muted-foreground truncate">{fileName}</p>
            </div>
            <Sparkles className="h-5 w-5 text-accent" />
          </div>

          <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> {wordCount} words</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingTime} min read</span>
          </div>

          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Download TXT
            </Button>
          </div>

          <Separator className="mb-4" />

          <ScrollArea className="h-[400px] pr-4">
            <div className="prose prose-sm max-w-none">
              {isVideoSummary && timestampedContent.length > 0 ? (
                <div className="space-y-3">
                  {timestampedContent.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 flex-shrink-0">
                        <Play className="h-3 w-3" />
                      </Button>
                      <div className="flex-1">
                        <span className="font-mono text-xs bg-primary/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {item.timestamp}
                        </span>
                        <p className="text-foreground leading-relaxed text-sm mt-1">{item.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : isLong ? (
                sections.map((section, i) => (
                  <Collapsible key={i} defaultOpen={i < 2}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 text-sm font-semibold hover:text-primary transition-colors group">
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:-rotate-90" />
                      Section {i + 1}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap text-sm pl-6 pb-3">{section.trim()}</p>
                    </CollapsibleContent>
                  </Collapsible>
                ))
              ) : (
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
              )}
            </div>
          </ScrollArea>
        </Card>
      </motion.div>

      {/* Q&A Section */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-accent/10">
              <MessageSquare className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-xl font-bold font-display">Ask Questions</h2>
          </div>

          <ScrollArea className="h-[300px] mb-4 pr-4">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Ask me anything about this content</p>
              </div>
            ) : (
              <div className="space-y-4">
                {chatHistory.map((message, index) => (
                  <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                ))}
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-4 py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <Separator className="mb-4" />
          <div className="flex gap-2">
            <Input placeholder="Ask about the content..." value={question} onChange={(e) => setQuestion(e.target.value)} onKeyPress={handleKeyPress} disabled={isAsking} className="flex-1" />
            <Button onClick={handleAskQuestion} disabled={!question.trim() || isAsking} size="icon" className="shrink-0">
              {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
