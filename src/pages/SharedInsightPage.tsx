import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Brain, Loader2, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

interface SharedInsight {
  id: string;
  content: string;
  tone: string;
  length: string;
  theme_count: number;
  document_count: number;
  source_ids: any;
  created_at: string;
}

export default function SharedInsightPage() {
  const { token } = useParams<{ token: string }>();
  const [insight, setInsight] = useState<SharedInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await supabase
        .from("insights_history" as any)
        .select("id, content, tone, length, theme_count, document_count, source_ids, created_at")
        .eq("share_token", token)
        .maybeSingle();
      if (!data) setNotFound(true);
      else setInsight(data as any);
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !insight) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <h1 className="text-2xl font-bold">Insight not found</h1>
        <p className="text-sm text-muted-foreground">This shared link may have been revoked or is invalid.</p>
        <Link to="/" className="text-primary hover:underline text-sm">← Back home</Link>
      </div>
    );
  }

  const sources: { id: string; title: string; type: string }[] = Array.isArray(insight.source_ids) ? insight.source_ids : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <header className="flex items-center gap-3">
          <div className="p-3 rounded-2xl animated-gradient">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Shared AI Insights</h1>
            <p className="text-xs text-muted-foreground">View-only · Generated {new Date(insight.created_at).toLocaleString()}</p>
          </div>
        </header>

        <Card className="p-6 bg-gradient-card border-border/50">
          <div className="flex flex-wrap gap-1.5 mb-4">
            <Badge variant="secondary" className="text-[10px]">{insight.tone}</Badge>
            <Badge variant="secondary" className="text-[10px]">{insight.length}</Badge>
            <Badge variant="secondary" className="text-[10px]">{insight.theme_count} themes</Badge>
            <Badge variant="outline" className="text-[10px]">{insight.document_count} docs</Badge>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{insight.content}</ReactMarkdown>
          </div>
          {sources.length > 0 && (
            <>
              <Separator className="my-4" />
              <p className="text-xs font-semibold mb-2">Source documents</p>
              <div className="flex flex-wrap gap-1.5">
                {sources.map(src => (
                  <Badge key={src.id} variant="outline" className="text-[10px] gap-1">
                    <FileText className="h-3 w-3" />{src.title}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Powered by AI Second Brain · <Link to="/" className="text-primary hover:underline">Create your own</Link>
        </p>
      </div>
    </div>
  );
}