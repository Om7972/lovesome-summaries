import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User, Mail, Sparkles, Save, Loader2, Shield, Calendar, FileText,
  Youtube, Video, BookOpen, Clock, TrendingUp, Award, LogOut, Key,
  BarChart3, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { profile, user, signOut, todaySummaryCount } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Stats
  const [stats, setStats] = useState({
    totalSummaries: 0,
    pdfCount: 0,
    youtubeCount: 0,
    videoCount: 0,
    totalWords: 0,
    flashcardCount: 0,
    masteredCards: 0,
    highlightCount: 0,
    podcastCount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    setFullName(profile?.full_name || "");
  }, [profile]);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;
    setStatsLoading(true);

    const [summariesRes, flashcardsRes, highlightsRes, podcastsRes] = await Promise.all([
      supabase.from("summaries").select("type, word_count").eq("user_id", user.id),
      supabase.from("flashcard_reviews").select("repetitions").eq("user_id", user.id),
      supabase.from("highlights").select("id").eq("user_id", user.id),
      supabase.from("podcasts").select("id").eq("user_id", user.id),
    ]);

    const summaries = summariesRes.data || [];
    const flashcards = flashcardsRes.data || [];
    const highlights = highlightsRes.data || [];
    const podcasts = podcastsRes.data || [];

    setStats({
      totalSummaries: summaries.length,
      pdfCount: summaries.filter(s => s.type === "pdf").length,
      youtubeCount: summaries.filter(s => s.type === "youtube").length,
      videoCount: summaries.filter(s => s.type === "video").length,
      totalWords: summaries.reduce((sum, s) => sum + (s.word_count || 0), 0),
      flashcardCount: flashcards.length,
      masteredCards: flashcards.filter(f => f.repetitions >= 3).length,
      highlightCount: highlights.length,
      podcastCount: podcasts.length,
    });
    setStatsLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Profile updated successfully." });
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Password updated successfully." });
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const timeSaved = Math.round(stats.totalWords / 200);
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";

  const statCards = [
    { label: "Total Summaries", value: stats.totalSummaries, icon: BarChart3, color: "text-primary" },
    { label: "PDF Summaries", value: stats.pdfCount, icon: FileText, color: "text-blue-500" },
    { label: "YouTube Summaries", value: stats.youtubeCount, icon: Youtube, color: "text-red-500" },
    { label: "Video Summaries", value: stats.videoCount, icon: Video, color: "text-purple-500" },
    { label: "Flashcards", value: stats.flashcardCount, icon: BookOpen, color: "text-amber-500" },
    { label: "Mastered Cards", value: stats.masteredCards, icon: Award, color: "text-emerald-500" },
    { label: "Highlights", value: stats.highlightCount, icon: Zap, color: "text-orange-500" },
    { label: "Podcasts", value: stats.podcastCount, icon: TrendingUp, color: "text-pink-500" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold font-display mb-2">Profile</h1>
        <p className="text-muted-foreground">Manage your account and view your learning statistics</p>
      </motion.div>

      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="p-8 glass-card-strong">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-10 w-10 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold font-display">{profile?.full_name || "User"}</h2>
                {profile?.is_premium ? (
                  <Badge className="animated-gradient text-primary-foreground gap-1">
                    <Sparkles className="h-3 w-3" /> Pro
                  </Badge>
                ) : (
                  <Badge variant="secondary">Free Plan</Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                <Mail className="h-4 w-4" /> {profile?.email}
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Member since {memberSince}
              </p>
            </div>
            {!profile?.is_premium && (
              <Button asChild className="animated-gradient text-primary-foreground btn-glow gap-2 shrink-0">
                <a href="/pricing"><Sparkles className="h-4 w-4" /> Upgrade to Pro</a>
              </Button>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Usage Stats */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h3 className="text-lg font-semibold font-display mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Learning Statistics
        </h3>

        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="glass-card p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-20 mb-2" />
                <div className="h-8 bg-muted rounded w-12" />
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {statCards.map((stat, i) => (
                <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.03 }}>
                  <Card className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                    </div>
                    <p className="text-2xl font-bold font-display">{stat.value}</p>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Summary Highlights Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="glass-card p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-display">{timeSaved}m</p>
                  <p className="text-xs text-muted-foreground">Reading time saved</p>
                </div>
              </Card>
              <Card className="glass-card p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10">
                  <FileText className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-display">{stats.totalWords.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Words summarized</p>
                </div>
              </Card>
              <Card className="glass-card p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/10">
                  <Award className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-display">{todaySummaryCount}</p>
                  <p className="text-xs text-muted-foreground">Summaries today</p>
                </div>
              </Card>
            </div>

            {/* Mastery Progress */}
            {stats.flashcardCount > 0 && (
              <Card className="glass-card p-5 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Flashcard Mastery</span>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    {Math.round((stats.masteredCards / stats.flashcardCount) * 100)}%
                  </span>
                </div>
                <Progress value={(stats.masteredCards / stats.flashcardCount) * 100} className="h-2.5" />
                <p className="text-xs text-muted-foreground mt-2">
                  {stats.masteredCards} of {stats.flashcardCount} cards mastered
                </p>
              </Card>
            )}
          </>
        )}
      </motion.div>

      {/* Edit Profile */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h3 className="text-lg font-semibold font-display mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" /> Edit Profile
        </h3>
        <Card className="glass-card-strong p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              {profile?.email}
            </div>
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </Card>
      </motion.div>

      {/* Change Password */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 className="text-lg font-semibold font-display mb-4 flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" /> Change Password
        </h3>
        <Card className="glass-card-strong p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword} variant="outline" className="gap-2">
            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Update Password
          </Button>
        </Card>
      </motion.div>

      {/* Plan & Account */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h3 className="text-lg font-semibold font-display mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> Account
        </h3>
        <Card className="glass-card-strong p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Current Plan</p>
              <p className="text-sm text-muted-foreground">
                {profile?.is_premium ? "Pro — Unlimited summaries" : "Free — 5 summaries per day"}
              </p>
            </div>
            {profile?.is_premium ? (
              <Badge className="animated-gradient text-primary-foreground gap-1"><Sparkles className="h-3 w-3" /> Pro</Badge>
            ) : (
              <Button asChild size="sm" variant="outline">
                <a href="/pricing">Upgrade</a>
              </Button>
            )}
          </div>

          {!profile?.is_premium && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Daily Usage</span>
                <span className="text-xs font-semibold">{todaySummaryCount}/5</span>
              </div>
              <Progress value={(todaySummaryCount / 5) * 100} className="h-2" />
            </div>
          )}

          <Separator />

          <Button variant="destructive" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </Card>
      </motion.div>
    </div>
  );
}
