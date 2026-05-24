import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Brain, Loader2, FileText, Lock, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  expires_at?: string | null;
  password_hash?: string | null;
}

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function SharedInsightPage() {
  const { token } = useParams<{ token: string }>();
  const [insight, setInsight] = useState<SharedInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expired, setExpired] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pwError, setPwError] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await supabase
        .from("insights_history" as any)
        .select("id, content, tone, length, theme_count, document_count, source_ids, created_at, expires_at, password_hash")
        .eq("share_token", token)
        .maybeSingle();
      if (!data) {
        setNotFound(true);
      } else {
        const ins = data as any as SharedInsight;
        if (ins.expires_at && new Date(ins.expires_at).getTime() <= Date.now()) {
          setExpired(true);
        } else {
          setInsight(ins);
          if (ins.password_hash) setNeedsPassword(true);
          else setUnlocked(true);
        }
      }
      setLoading(false);
    })();
  }, [token]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insight?.password_hash) return;
    setVerifying(true);
    setPwError("");
    const h = await sha256Hex(passwordInput.trim());
    if (h === insight.password_hash) {
      setUnlocked(true);
      setNeedsPassword(false);
    } else {
      setPwError("Incorrect password. Please try again.");
    }
    setVerifying(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || (!insight && !expired)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <h1 className="text-2xl font-bold">Insight not found</h1>
        <p className="text-sm text-muted-foreground">This shared link may have been revoked or is invalid.</p>
        <Link to="/" className="text-primary hover:underline text-sm">← Back home</Link>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4">
        <div className="p-3 rounded-full bg-muted"><Clock className="h-6 w-6 text-muted-foreground" /></div>
        <h1 className="text-2xl font-bold">Link expired</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">This shared insights link has expired and no longer grants access.</p>
        <Link to="/" className="text-primary hover:underline text-sm">← Back home</Link>
      </div>
    );
  }

  if (needsPassword && !unlocked && insight) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-6 w-full max-w-sm space-y-4 bg-gradient-card border-border/50">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-3 rounded-full bg-primary/10"><Lock className="h-5 w-5 text-primary" /></div>
            <h1 className="text-lg font-bold font-display">Password required</h1>
            <p className="text-xs text-muted-foreground">This shared insight is protected. Enter the password to view.</p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <Input type="password" autoFocus value={passwordInput} onChange={e => setPasswordInput(e.target.value)} required />
              {pwError && <p className="text-xs text-destructive">{pwError}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={verifying || !passwordInput.trim()}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (!insight) return null;

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
            <p className="text-xs text-muted-foreground">
              View-only · Generated {new Date(insight.created_at).toLocaleString()}
              {insight.expires_at && <> · Expires {new Date(insight.expires_at).toLocaleString()}</>}
            </p>
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