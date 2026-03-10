import { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings, User, Bell, Key, Shield, Moon, Sun, Monitor,
  Save, Loader2, Eye, EyeOff, Check, AlertTriangle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  // Account
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);

  // Notifications
  const [emailSummaries, setEmailSummaries] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);

  // API Keys (display only, managed via secrets)
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showElevenLabs, setShowElevenLabs] = useState(false);

  const handleSaveProfile = async () => {
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

  const sectionDelay = (i: number) => ({ initial: { opacity: 0, y: 15 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.1 } });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display flex items-center gap-3">
          <div className="p-2.5 rounded-xl animated-gradient">
            <Settings className="h-5 w-5 text-primary-foreground" />
          </div>
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">Manage your account, preferences, and integrations</p>
      </div>

      {/* Account Preferences */}
      <motion.div {...sectionDelay(0)}>
        <Card className="glass-card-strong p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display">Account Preferences</h2>
              <p className="text-xs text-muted-foreground">Your personal information and display settings</p>
            </div>
          </div>
          <Separator />

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Full Name</Label>
              <Input
                id="settings-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email || ""} disabled className="bg-muted/50 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Appearance</Label>
            <div className="flex gap-2">
              {[
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: Monitor, label: "System" },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  variant={theme === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(opt.value)}
                  className="gap-2 flex-1"
                >
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Default Summary Length</Label>
            <Select defaultValue="medium">
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </Card>
      </motion.div>

      {/* Notification Settings */}
      <motion.div {...sectionDelay(1)}>
        <Card className="glass-card-strong p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display">Notifications</h2>
              <p className="text-xs text-muted-foreground">Choose what notifications you receive</p>
            </div>
          </div>
          <Separator />

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Summary Completion Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified when long summaries finish processing</p>
              </div>
              <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Weekly Summary Digest</p>
                <p className="text-xs text-muted-foreground">Receive a weekly email with your activity overview</p>
              </div>
              <Switch checked={emailSummaries} onCheckedChange={setEmailSummaries} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Product Updates</p>
                <p className="text-xs text-muted-foreground">Learn about new features and improvements</p>
              </div>
              <Switch checked={emailUpdates} onCheckedChange={setEmailUpdates} />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* API Key Management */}
      <motion.div {...sectionDelay(2)}>
        <Card className="glass-card-strong p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Key className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display">API Keys</h2>
              <p className="text-xs text-muted-foreground">Manage your third-party service integrations</p>
            </div>
          </div>
          <Separator />

          <div className="space-y-4">
            {/* OpenAI */}
            <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">AI</div>
                  <div>
                    <p className="text-sm font-medium">OpenAI API Key</p>
                    <p className="text-xs text-muted-foreground">Used for Whisper video transcription</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs text-success-foreground font-medium">Connected</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type={showOpenAI ? "text" : "password"}
                  value="sk-••••••••••••••••••••••••"
                  disabled
                  className="flex-1 bg-muted/30 text-xs font-mono"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowOpenAI(!showOpenAI)}>
                  {showOpenAI ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3 w-3" /> Keys are stored securely and never exposed in your code
              </p>
            </div>

            {/* ElevenLabs */}
            <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">🎧</div>
                  <div>
                    <p className="text-sm font-medium">ElevenLabs API Key</p>
                    <p className="text-xs text-muted-foreground">Used for AI podcast generation</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs text-success-foreground font-medium">Connected</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type={showElevenLabs ? "text" : "password"}
                  value="xi-••••••••••••••••••••••••"
                  disabled
                  className="flex-1 bg-muted/30 text-xs font-mono"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowElevenLabs(!showElevenLabs)}>
                  {showElevenLabs ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3 w-3" /> Keys are stored securely and never exposed in your code
              </p>
            </div>

            {/* Lovable AI */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg animated-gradient flex items-center justify-center text-xs font-bold text-primary-foreground">✨</div>
                  <div>
                    <p className="text-sm font-medium">Lovable AI</p>
                    <p className="text-xs text-muted-foreground">Powers summarization, quizzes, and knowledge search</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs text-success-foreground font-medium">Auto-configured</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">No setup required — included with your account.</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Danger Zone */}
      <motion.div {...sectionDelay(3)}>
        <Card className="glass-card p-8 space-y-4 border-destructive/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-destructive">Danger Zone</h2>
              <p className="text-xs text-muted-foreground">Irreversible account actions</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete all summaries</p>
              <p className="text-xs text-muted-foreground">Permanently delete all your content and data</p>
            </div>
            <Button variant="destructive" size="sm">Delete All Data</Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
