import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Brain, Loader2, FileText, Lock, Clock, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

interface SharedInsightMeta {
  id: string;
  created_at: string;
  tone: string;
  length: string;
  theme_count: number;
  document_count: number;
  expires_at: string | null;
  has_password: boolean;
}

interface SharedInsightFull {
  id: string;
  content: string;
  tone: string;
  length: string;
  theme_count: number;
  document_count: number;
  source_ids: any;
  created_at: string;
  expires_at?: string | null;
}

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function SharedInsightPage() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<SharedInsightMeta | null>(null);
  const [insight, setInsight] = useState<SharedInsightFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expired, setExpired] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pwError, setPwError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await (supabase.rpc as any)("get_shared_insight_meta", { _token: token });
      if (error || !data || !data.length) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const m = data[0] as any as SharedInsightMeta & { expired: boolean; exists_flag: boolean };
      if (m.expired) {
        setMeta(m);
        setExpired(true);
      } else if (m.has_password) {
        setMeta(m);
        setNeedsPassword(true);
      } else {
        // Fetch full content directly (no password required)
        const { data: full, error: fErr } = await (supabase.rpc as any)("get_shared_insight_content", { _token: token, _password_hash: null });
        if (fErr || !full || !full.length) {
          setNotFound(true);
        } else {
          setMeta(m);
          setInsight(full[0] as any as SharedInsightFull);
          setUnlocked(true);
        }
      }
      setLoading(false);
    })();
  }, [token]);

  // Live countdown ticker
  useEffect(() => {
    if (!meta?.expires_at || expired) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (meta.expires_at && new Date(meta.expires_at).getTime() <= t) {
        setExpired(true);
        setUnlocked(false);
        setInsight(null);
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [meta?.expires_at, expired]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !meta) return;
    setVerifying(true);
    setPwError("");
    const h = await sha256Hex(passwordInput.trim());
    const { data, error } = await (supabase.rpc as any)("get_shared_insight_content", { _token: token, _password_hash: h });
    if (error) {
      const msg = String(error.message || "");
      if (msg.includes("rate_limited")) {
        setRateLimited(true);
        setPwError("Too many failed attempts. Try again in 15 minutes.");
      } else if (msg.includes("invalid_password")) {
        setPwError("Incorrect password. Please try again.");
      } else if (msg.includes("expired")) {
        setExpired(true);
      } else if (msg.includes("not_found")) {
        setNotFound(true);
      } else {
        setPwError("Unable to verify. Please try again.");
      }
    } else if (data && data.length) {
      setInsight(data[0] as any as SharedInsightFull);
      setUnlocked(true);
      setNeedsPassword(false);
    }
    setVerifying(false);
    setPasswordInput("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
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
        <div className="p-4 rounded-full bg-destructive/10 ring-4 ring-destructive/5">
          <Clock className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold font-display">This link has expired</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          The owner set this shared insights link to expire
          {meta?.expires_at && <> on <span className="font-medium text-foreground">{new Date(meta.expires_at).toLocaleString()}</span></>}.
          It no longer grants access.
        </p>
        <Badge variant="destructive" className="mt-1">Access revoked by expiration</Badge>
        <Link to="/" className="text-primary hover:underline text-sm">← Back home</Link>
      </div>
    );
  }

  if (needsPassword && !unlocked && meta) {
    const msLeft = meta.expires_at ? new Date(meta.expires_at).getTime() - now : null;
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-6 w-full max-w-sm space-y-4 bg-gradient-card border-border/50">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-3 rounded-full bg-primary/10">
              {rateLimited ? <ShieldAlert className="h-5 w-5 text-destructive" /> : <Lock className="h-5 w-5 text-primary" />}
            </div>
            <h1 className="text-lg font-bold font-display">Password required</h1>
            <p className="text-xs text-muted-foreground">This shared insight is protected. Enter the password to view.</p>
            {msLeft !== null && (
              <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> Expires in {formatCountdown(msLeft)}
              </p>
            )}
          </div>
          <form onSubmit={handleUnlock} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <Input type="password" autoFocus value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)} required disabled={rateLimited} />
              {pwError && <p className="text-xs text-destructive">{pwError}</p>}
              {!pwError && !rateLimited && (
                <p className="text-[10px] text-muted-foreground">Limited to 5 attempts per 15 minutes.</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={verifying || !passwordInput.trim() || rateLimited}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (!insight) return null;

  const sources: { id: string; title: string; type: string }[] = Array.isArray(insight.source_ids) ? insight.source_ids : [];
  const msLeft = insight.expires_at ? new Date(insight.expires_at).getTime() - now : null;
  const isExpiringSoon = msLeft !== null && msLeft > 0 && msLeft < 60 * 60 * 1000;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <header className="flex items-center gap-3">
          <div className="p-3 rounded-2xl animated-gradient">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-display">Shared AI Insights</h1>
            <p className="text-xs text-muted-foreground">
              View-only · Generated {new Date(insight.created_at).toLocaleString()}
            </p>
          </div>
          {msLeft !== null && (
            <Badge variant={isExpiringSoon ? "destructive" : "secondary"}
              className="gap-1.5 text-[11px] py-1.5 px-2.5 font-mono tabular-nums">
              <Clock className="h-3 w-3" />
              {formatCountdown(msLeft)}
            </Badge>
          )}
        </header>
        {msLeft !== null && (
          <p className="text-[11px] text-muted-foreground -mt-3">
            Link expires on {new Date(insight.expires_at!).toLocaleString()}
          </p>
        )}

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