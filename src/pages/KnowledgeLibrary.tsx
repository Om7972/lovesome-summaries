import { useState, useRef, useEffect } from "react";
import { Search, Send, Loader2, Bot, User, BookOpen, FileText, Youtube, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ id: string; title: string; type: string; date: string }>;
}

const typeIcons: Record<string, any> = { pdf: FileText, youtube: Youtube, video: Video };

const suggestedQueries = [
  "What videos mentioned deep learning?",
  "Summarize what I've learned this week",
  "What are the key themes across my documents?",
  "Find connections between my summaries",
];

export default function KnowledgeLibrary() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const askQuestion = async (question: string) => {
    if (!question.trim() || isLoading || !user) return;

    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("search-knowledge", {
        body: { question, userId: user.id },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: err.message || "Sorry, I couldn't search your knowledge base.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askQuestion(input);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          Knowledge Library
        </h1>
        <p className="text-muted-foreground mt-1">Search across all your summaries and ask AI questions</p>
      </div>

      <Card className="p-6 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
        <div ref={scrollRef} className="h-[500px] overflow-y-auto pr-2 mb-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="p-6 rounded-full bg-muted/50 mb-6">
                <Search className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-bold font-display mb-2">Ask your Knowledge Base</h2>
              <p className="text-sm text-muted-foreground mb-8 max-w-md">
                Search across all your summarized content. I'll find relevant information and cite sources.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {suggestedQueries.map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-3 px-4 text-left whitespace-normal"
                    onClick={() => askQuestion(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <AnimatePresence>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`p-1.5 rounded-full shrink-0 h-8 w-8 flex items-center justify-center ${
                      msg.role === "user" ? "bg-primary/10" : "bg-accent/10"
                    }`}>
                      {msg.role === "user" ? (
                        <User className="h-4 w-4 text-primary" />
                      ) : (
                        <Bot className="h-4 w-4 text-accent" />
                      )}
                    </div>
                    <div className={`max-w-[80%] ${msg.role === "user" ? "" : ""}`}>
                      <div className={`rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.sources.map((s, i) => {
                            const Icon = typeIcons[s.type] || FileText;
                            return (
                              <div key={i} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-muted/50 border border-border/50">
                                <Icon className="h-3 w-3 text-primary" />
                                <span className="truncate max-w-[150px]">{s.title}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <div className="flex gap-3">
                  <div className="p-1.5 rounded-full bg-accent/10 h-8 w-8 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-accent" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator className="mb-4" />
        <div className="flex gap-2">
          <Input
            placeholder="Ask about your knowledge base..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={() => askQuestion(input)} disabled={!input.trim() || isLoading} size="icon" className="shrink-0">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}
