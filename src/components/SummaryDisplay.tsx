import { useState } from "react";
<<<<<<< HEAD
<<<<<<< HEAD
import { FileText, MessageSquare, Sparkles, Send, Loader2, Youtube, Clock, Play } from "lucide-react";
=======
import { FileText, MessageSquare, Sparkles, Send, Loader2, Download } from "lucide-react";
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
=======
import { FileText, MessageSquare, Sparkles, Send, Loader2, Download, Copy, Check, ChevronDown, Clock, BarChart3 } from "lucide-react";
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d
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

  // Split summary into sections by double newline or headings
  const sections = summary.split(/\n{2,}/).filter(s => s.trim());
  const isLong = sections.length > 3;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    toast({ title: "Copied!", description: "Summary copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

<<<<<<< HEAD
  // Parse timestamped content for video summaries
  const parseTimestampedContent = (text: string): TimestampedContent[] => {
    const lines = text.split('\n');
    const timestampedContent: TimestampedContent[] = [];
    
    lines.forEach(line => {
      // Match timestamp patterns like [00:15] or [12:30:45]
      const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/;
      const match = line.match(timestampRegex);
      
      if (match) {
        const timestamp = match[1];
        const content = line.replace(timestampRegex, '').trim();
        timestampedContent.push({ timestamp, content });
      }
    });
    
    return timestampedContent;
  };

  // Check if this is a video summary by looking for timestamp patterns
  const isVideoSummary = summary.includes("[00:") || summary.includes("Timestamp") || summary.includes("timestamp");
  const timestampedContent = isVideoSummary ? parseTimestampedContent(summary) : [];

  // Render summary content with special handling for timestamps
  const renderSummaryContent = () => {
    if (isVideoSummary && timestampedContent.length > 0) {
      return (
        <div className="space-y-4">
          {timestampedContent.map((item, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={() => {
                  // In a real implementation, this would seek to the timestamp in the video
                  console.log(`Seek to ${item.timestamp}`);
                }}
              >
                <Play className="h-3 w-3" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-mono text-sm bg-primary/10 px-2 py-0.5 rounded">
                    {item.timestamp}
                  </span>
                </div>
                <p className="text-foreground leading-relaxed">
                  {item.content}
                </p>
              </div>
            </div>
          ))}
          
          {/* Render any remaining non-timestamped content */}
          {summary.split('\n').map((line, index) => {
            if (!line.match(/\[\d{1,2}:\d{2}/)) {
              return (
                <p key={index} className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {line}
                </p>
              );
            }
            return null;
          })}
        </div>
      );
    }
    
    return (
      <p className="text-foreground leading-relaxed whitespace-pre-wrap">
        {summary}
      </p>
    );
=======
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
<<<<<<< HEAD
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
=======
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
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Summary Section */}
<<<<<<< HEAD
      <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            {fileName.includes("Video") || fileName.includes("YouTube") ? (
              <Youtube className="h-5 w-5 text-red-500" />
            ) : (
              <FileText className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">Content Summary</h2>
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
            {renderSummaryContent()}
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
                Ask me anything about this content
              </p>
=======
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold font-display">Document Summary</h2>
              <p className="text-sm text-muted-foreground truncate">{fileName}</p>
            </div>
            <Sparkles className="h-5 w-5 text-accent" />
          </div>

          {/* Stats */}
          <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> {wordCount} words</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingTime} min read</span>
          </div>

          {/* Action Buttons */}
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
              {isLong ? (
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

<<<<<<< HEAD
        <div className="flex gap-2">
          <Input
            placeholder="Ask about the content..."
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
=======
          <ScrollArea className="h-[300px] mb-4 pr-4">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Ask me anything about this document</p>
              </div>
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d
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
            <Input placeholder="Ask about the document..." value={question} onChange={e => setQuestion(e.target.value)} onKeyPress={handleKeyPress} disabled={isAsking} className="flex-1" />
            <Button onClick={handleAskQuestion} disabled={!question.trim() || isAsking} size="icon" className="shrink-0">
              {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};