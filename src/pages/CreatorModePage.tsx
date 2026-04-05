import { useState, useEffect } from "react";
import { Wand2, Copy, Download, Loader2, Check, Linkedin, Twitter, BookOpen, Youtube, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

const contentTypes = [
  { value: "linkedin", label: "LinkedIn Post", icon: Linkedin, badge: "🚀 Growth Content", color: "text-blue-500" },
  { value: "twitter", label: "Twitter Thread", icon: Twitter, badge: "🔥 Viral Post", color: "text-sky-500" },
  { value: "blog", label: "Blog Article", icon: BookOpen, badge: "📝 Long-form", color: "text-emerald-500" },
  { value: "youtube_script", label: "YouTube Script", icon: Youtube, badge: "🎬 Video Script", color: "text-red-500" },
];

interface Summary {
  id: string;
  original_source: string;
  type: string;
  created_at: string;
}

interface GeneratedContent {
  id?: string;
  title: string;
  content: string;
  type: string;
  created_at?: string;
  summary_id?: string;
}

export default function CreatorModePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [history, setHistory] = useState<GeneratedContent[]>([]);
  const [copied, setCopied] = useState(false);
  const [displayedContent, setDisplayedContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: sums }, { data: outputs }] = await Promise.all([
        supabase.from("summaries").select("id, original_source, type, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("content_outputs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);
      if (sums) setSummaries(sums);
      if (outputs) setHistory(outputs as GeneratedContent[]);
    };
    fetchData();
  }, [user]);

  // Typing animation
  useEffect(() => {
    if (!generatedContent) return;
    setIsTyping(true);
    setDisplayedContent("");
    const full = generatedContent.content;
    let i = 0;
    const speed = Math.max(5, Math.min(15, 3000 / full.length));
    const interval = setInterval(() => {
      i += 3;
      if (i >= full.length) {
        setDisplayedContent(full);
        setIsTyping(false);
        clearInterval(interval);
      } else {
        setDisplayedContent(full.substring(0, i));
      }
    }, speed);
    return () => clearInterval(interval);
  }, [generatedContent]);

  const handleGenerate = async () => {
    if (!selectedSummary || !selectedType || !user) return;
    setIsGenerating(true);
    setGeneratedContent(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { summaryId: selectedSummary, contentType: selectedType, userId: user.id },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      const newContent: GeneratedContent = { title: data.title, content: data.content, type: selectedType };
      setGeneratedContent(newContent);
      setHistory(prev => [newContent, ...prev]);
      toast({ title: "Content generated!", description: `Your ${selectedType} content is ready` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate content", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedContent) return;
    await navigator.clipboard.writeText(generatedContent.content);
    setCopied(true);
    toast({ title: "Copied!", description: "Content copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatedContent) return;
    const blob = new Blob([`# ${generatedContent.title}\n\n${generatedContent.content}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generatedContent.title.replace(/[^a-z0-9]/gi, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeInfo = contentTypes.find(t => t.value === selectedType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="p-3 rounded-2xl animated-gradient">
          <Wand2 className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">Auto Content Creator</h1>
          <p className="text-sm text-muted-foreground">Transform summaries into viral content in seconds</p>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="space-y-4">
          <Card className="p-5 bg-gradient-card backdrop-blur-sm border-border/50">
            <h3 className="font-semibold mb-3 text-sm">1. Select Summary</h3>
            <Select value={selectedSummary} onValueChange={setSelectedSummary}>
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Choose a summary..." />
              </SelectTrigger>
              <SelectContent>
                {summaries.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="truncate">{s.original_source}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          <Card className="p-5 bg-gradient-card backdrop-blur-sm border-border/50">
            <h3 className="font-semibold mb-3 text-sm">2. Choose Content Type</h3>
            <div className="grid grid-cols-2 gap-2">
              {contentTypes.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => setSelectedType(ct.value)}
                  className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                    selectedType === ct.value
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border/50 bg-card/50 hover:bg-muted/50"
                  }`}
                >
                  <ct.icon className={`h-5 w-5 mb-1 ${ct.color}`} />
                  <div className="text-xs font-medium">{ct.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{ct.badge}</div>
                </button>
              ))}
            </div>
          </Card>

          <Button
            onClick={handleGenerate}
            disabled={!selectedSummary || !selectedType || isGenerating}
            className="w-full gap-2"
            size="lg"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {isGenerating ? "Generating..." : "Generate Content"}
          </Button>

          {/* History */}
          {history.length > 0 && (
            <Card className="p-4 bg-gradient-card backdrop-blur-sm border-border/50">
              <h3 className="font-semibold mb-2 text-sm">Recent Generations</h3>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {history.slice(0, 10).map((item, i) => {
                    const ct = contentTypes.find(c => c.value === item.type);
                    return (
                      <div key={i} className="p-2 rounded-lg bg-muted/30 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => { setGeneratedContent(item); }}>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">{ct?.badge || item.type}</Badge>
                        </div>
                        <p className="mt-1 truncate font-medium">{item.title}</p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* Right: Generated Content */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="p-12 bg-gradient-card backdrop-blur-sm border-border/50 flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full animated-gradient opacity-20 blur-xl" />
                    <Loader2 className="h-12 w-12 animate-spin text-primary relative" />
                  </div>
                  <p className="text-sm text-muted-foreground animate-pulse">
                    ✨ Crafting your {typeInfo?.label || "content"}...
                  </p>
                </Card>
              </motion.div>
            ) : generatedContent ? (
              <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-gradient-card backdrop-blur-sm border-border/50 overflow-hidden">
                  <div className="p-4 border-b border-border/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {typeInfo && <typeInfo.icon className={`h-4 w-4 ${typeInfo.color}`} />}
                      <h3 className="font-bold text-sm">{generatedContent.title}</h3>
                      {typeInfo && <Badge variant="secondary" className="text-[10px]">{typeInfo.badge}</Badge>}
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5 text-xs">
                        <Download className="h-3 w-3" /> Download
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[500px] p-6">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{isTyping ? displayedContent : generatedContent.content}</ReactMarkdown>
                      {isTyping && <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />}
                    </div>
                  </ScrollArea>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="p-16 bg-gradient-card backdrop-blur-sm border-border/50 flex flex-col items-center justify-center text-center">
                  <div className="p-4 rounded-full bg-accent/10 mb-4">
                    <Wand2 className="h-10 w-10 text-accent" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Ready to Create</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Select a summary and content type, then hit Generate to transform your knowledge into shareable content.
                  </p>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
