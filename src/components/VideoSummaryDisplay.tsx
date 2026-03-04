import { useState } from "react";
import { Video, MessageSquare, Sparkles, Send, Loader2, List, AlignLeft, Download, Copy, Check, Clock, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface VideoSummaryDisplayProps {
  summary: string;
  videoName: string;
  timestamps?: Array<{ time: string; text: string }>;
  onAskQuestion: (question: string) => Promise<string>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const VideoSummaryDisplay = ({ summary, videoName, timestamps = [], onAskQuestion }: VideoSummaryDisplayProps) => {
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [summaryFormat, setSummaryFormat] = useState<"bullet" | "paragraph">("bullet");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const wordCount = summary.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    toast({ title: "Copied!", description: "Summary copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const timestampText = timestamps.length > 0 ? '\n\nTimestamps:\n' + timestamps.map(t => `[${t.time}] ${t.text}`).join('\n') : '';
    const content = `Video: ${videoName}\n\nSummary:\n${summary}${timestampText}\n\n${chatHistory.length > 0 ? '\nQ&A History:\n' + chatHistory.map(msg => `${msg.role === 'user' ? 'Q' : 'A'}: ${msg.content}`).join('\n\n') : ''}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoName.replace(/[^a-z0-9]/gi, '_')}_summary.txt`;
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
    setChatHistory(prev => [...prev, { role: "user", content: userMessage }]);
    setIsAsking(true);
    try {
      const answer = await onAskQuestion(userMessage);
      setChatHistory(prev => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setChatHistory(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that question. Please try again." }]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAskQuestion(); }
  };

  const formatSummary = (text: string) => {
    if (summaryFormat === "bullet") {
      return text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        return <li key={i} className="ml-4 mb-2">{trimmed.replace(/^[•\-\*]\s*/, '')}</li>;
      }).filter(Boolean);
    }
    return <p className="leading-relaxed whitespace-pre-wrap">{text}</p>;
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Summary Section */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold font-display">Video Summary</h2>
                <p className="text-sm text-muted-foreground truncate">{videoName}</p>
              </div>
            </div>
            <Sparkles className="h-5 w-5 text-accent" />
          </div>

          {/* Stats */}
          <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> {wordCount} words</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingTime} min read</span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Download TXT
            </Button>
            <div className="flex gap-1 ml-auto">
              <Button variant={summaryFormat === "bullet" ? "default" : "outline"} size="sm" onClick={() => setSummaryFormat("bullet")} className="gap-1.5 text-xs">
                <List className="h-3.5 w-3.5" /> Bullet
              </Button>
              <Button variant={summaryFormat === "paragraph" ? "default" : "outline"} size="sm" onClick={() => setSummaryFormat("paragraph")} className="gap-1.5 text-xs">
                <AlignLeft className="h-3.5 w-3.5" /> Paragraph
              </Button>
            </div>
          </div>

          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="timestamps">Timestamps</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              <ScrollArea className="h-[400px] pr-4">
                <div className="prose prose-sm max-w-none text-foreground">
                  {summaryFormat === "bullet" ? <ul className="list-disc space-y-1">{formatSummary(summary)}</ul> : formatSummary(summary)}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="timestamps">
              <ScrollArea className="h-[400px] pr-4">
                {timestamps.length > 0 ? (
                  <div className="space-y-3">
                    {timestamps.map((item, idx) => (
                      <div key={idx} className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <span className="text-xs font-mono text-primary shrink-0 mt-0.5">{item.time}</span>
                        <p className="text-sm leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                    <p className="text-sm">No timestamps available</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
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
                <p className="text-sm text-muted-foreground">Ask me anything about this video</p>
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
            <Input placeholder="Ask about the video..." value={question} onChange={e => setQuestion(e.target.value)} onKeyPress={handleKeyPress} disabled={isAsking} className="flex-1" />
            <Button onClick={handleAskQuestion} disabled={!question.trim() || isAsking} size="icon" className="shrink-0">
              {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
