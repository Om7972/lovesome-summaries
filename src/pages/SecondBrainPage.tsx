import { useState, useEffect, useCallback } from "react";
import { Brain, Search, MessageSquare, Share2, Loader2, Send, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { id: string; title: string; type: string; date: string }[];
}

interface Summary {
  id: string;
  original_source: string;
  summary_text: string;
  type: string;
  created_at: string;
  tldr: string | null;
  key_points: any;
}

export default function SecondBrainPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Summary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [allText, setAllText] = useState("");
  const [allSummary, setAllSummary] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchSummaries = async () => {
      const { data } = await supabase
        .from("summaries")
        .select("id, original_source, summary_text, type, created_at, tldr, key_points")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setSummaries(data);
        setAllText(data.map(s => s.summary_text).join("\n\n"));
        setAllSummary(data.map(s => s.tldr || s.summary_text.substring(0, 200)).join("\n"));
      }
    };
    fetchSummaries();
  }, [user]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !user) return;
    setIsSearching(true);
    try {
      const q = searchQuery.toLowerCase();
      const results = summaries.filter(s =>
        s.original_source.toLowerCase().includes(q) ||
        s.summary_text.toLowerCase().includes(q) ||
        (s.tldr && s.tldr.toLowerCase().includes(q))
      );
      setSearchResults(results);
      if (results.length === 0) {
        toast({ title: "No results", description: "Try a different search term" });
      }
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, summaries, user, toast]);

  const handleChat = async () => {
    if (!chatInput.trim() || !user) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("search-knowledge", {
        body: { question: chatInput, userId: user.id },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
      }]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to get answer", variant: "destructive" });
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="p-3 rounded-2xl animated-gradient">
          <Brain className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">AI Second Brain</h1>
          <p className="text-sm text-muted-foreground">
            {summaries.length} documents connected · Search & chat across your knowledge
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Documents", value: summaries.length, icon: "📄" },
          { label: "PDFs", value: summaries.filter(s => s.type === "pdf").length, icon: "📕" },
          { label: "Videos", value: summaries.filter(s => s.type === "youtube").length, icon: "🎬" },
          { label: "Insights", value: summaries.reduce((a, s) => a + (Array.isArray(s.key_points) ? (s.key_points as any[]).length : 0), 0), icon: "💡" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-4 bg-gradient-card backdrop-blur-sm border-border/50 hover:shadow-md transition-shadow">
              <div className="text-xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 bg-muted/50">
          <TabsTrigger value="search" className="gap-2"><Search className="h-4 w-4" /> Search</TabsTrigger>
          <TabsTrigger value="chat" className="gap-2"><MessageSquare className="h-4 w-4" /> Chat</TabsTrigger>
          <TabsTrigger value="graph" className="gap-2"><Share2 className="h-4 w-4" /> Graph</TabsTrigger>
        </TabsList>

        {/* SEARCH TAB */}
        <TabsContent value="search" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search across your knowledge base..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="bg-card/50"
            />
            <Button onClick={handleSearch} disabled={isSearching} className="gap-2">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>

          {searchResults.length > 0 ? (
            <div className="grid gap-3">
              <AnimatePresence>
                {searchResults.map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="p-4 bg-gradient-card backdrop-blur-sm border-border/50 hover:shadow-lg transition-all hover:scale-[1.01] cursor-pointer">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-[10px]">{s.type}</Badge>
                            <span className="text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                          </div>
                          <h3 className="font-semibold text-sm truncate">{s.original_source}</h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.tldr || s.summary_text.substring(0, 150)}</p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : searchQuery && !isSearching ? (
            <Card className="p-8 text-center bg-gradient-card border-border/50">
              <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
            </Card>
          ) : !searchQuery ? (
            <Card className="p-8 text-center bg-gradient-card border-border/50">
              <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">Search across all your summaries, highlights, and notes</p>
            </Card>
          ) : null}
        </TabsContent>

        {/* CHAT TAB */}
        <TabsContent value="chat" className="space-y-4">
          <Card className="bg-gradient-card backdrop-blur-sm border-border/50 overflow-hidden">
            <ScrollArea className="h-[400px] p-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="p-4 rounded-full bg-primary/10 mb-3">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg mb-1">Ask your Second Brain</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Ask questions across all your summaries. I'll find the answers and cite sources.
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {chatMessages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/70"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : msg.content}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/30 flex flex-wrap gap-1">
                          {msg.sources.map(src => (
                            <Badge key={src.id} variant="outline" className="text-[10px]">{src.title}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isChatLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-muted/70 rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </ScrollArea>
            <div className="p-4 border-t border-border/30 flex gap-2">
              <Input
                placeholder="Ask anything about your knowledge..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChat()}
                className="bg-background/50"
              />
              <Button onClick={handleChat} disabled={isChatLoading || !chatInput.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* GRAPH TAB */}
        <TabsContent value="graph">
          {allText ? (
            <KnowledgeGraph text={allText} summary={allSummary} />
          ) : (
            <Card className="p-8 text-center bg-gradient-card border-border/50">
              <Share2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">Add some summaries to visualize your knowledge graph</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
