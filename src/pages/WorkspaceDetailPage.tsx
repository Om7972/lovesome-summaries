import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Share2, Activity, Mail, Loader2, Trash2, ArrowLeft, FileText, Crown, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState("");

  // Workspace details
  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspace", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const isOwner = workspace?.owner_id === user?.id;

  // Members with profile info
  const { data: members } = useQuery({
    queryKey: ["workspace-members", id],
    queryFn: async () => {
      const { data: mems } = await supabase
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", id!);

      if (!mems?.length) return [];

      const userIds = mems.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);

      return mems.map((m: any) => ({
        ...m,
        profile: profiles?.find((p: any) => p.id === m.user_id),
      }));
    },
    enabled: !!id,
  });

  // Shared summaries
  const { data: sharedSummaries } = useQuery({
    queryKey: ["shared-summaries", id],
    queryFn: async () => {
      const { data: shared } = await supabase
        .from("shared_summaries")
        .select("*")
        .eq("workspace_id", id!)
        .order("created_at", { ascending: false });

      if (!shared?.length) return [];

      const summaryIds = shared.map((s: any) => s.summary_id);
      const { data: summaries } = await supabase
        .from("summaries")
        .select("id, original_source, summary_text, type, created_at, word_count")
        .in("id", summaryIds);

      const sharerIds = shared.map((s: any) => s.shared_by);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", sharerIds);

      return shared.map((s: any) => ({
        ...s,
        summary: summaries?.find((sum: any) => sum.id === s.summary_id),
        sharer: profiles?.find((p: any) => p.id === s.shared_by),
      }));
    },
    enabled: !!id,
  });

  // Activity feed
  const { data: activity } = useQuery({
    queryKey: ["workspace-activity", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_activity")
        .select("*")
        .eq("workspace_id", id!)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!data?.length) return [];

      const userIds = [...new Set(data.map((a: any) => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      return data.map((a: any) => ({
        ...a,
        profile: profiles?.find((p: any) => p.id === a.user_id),
      }));
    },
    enabled: !!id,
  });

  // User's summaries for sharing
  const { data: mySummaries } = useQuery({
    queryKey: ["my-summaries-for-share"],
    queryFn: async () => {
      const { data } = await supabase
        .from("summaries")
        .select("id, original_source, type, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Realtime subscription for shared summaries & activity
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`workspace-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shared_summaries", filter: `workspace_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["shared-summaries", id] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "workspace_activity", filter: `workspace_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["workspace-activity", id] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  // Invite member
  const inviteMutation = useMutation({
    mutationFn: async () => {
      // Look up user by email
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", inviteEmail.trim().toLowerCase())
        .single();

      if (!profile) throw new Error("User not found");

      const { error } = await supabase.from("workspace_members").insert({
        workspace_id: id!,
        user_id: profile.id,
        role: "member",
      });
      if (error) throw error;

      // Log activity
      await supabase.from("workspace_activity").insert({
        workspace_id: id!,
        user_id: user!.id,
        action: "invited_member",
        metadata: { email: inviteEmail },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", id] });
      setInviteEmail("");
      setInviteOpen(false);
      toast.success("Member invited!");
    },
    onError: (e: any) => toast.error(e.message || "Failed to invite"),
  });

  // Share summary
  const shareMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shared_summaries").insert({
        workspace_id: id!,
        summary_id: selectedSummary,
        shared_by: user!.id,
      });
      if (error) throw error;

      await supabase.from("workspace_activity").insert({
        workspace_id: id!,
        user_id: user!.id,
        action: "shared_summary",
        metadata: { summary_id: selectedSummary },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-summaries", id] });
      setSelectedSummary("");
      setShareOpen(false);
      toast.success("Summary shared with workspace!");
    },
    onError: () => toast.error("Failed to share — it may already be shared"),
  });

  // Remove member
  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await supabase.from("workspace_members").delete().eq("id", memberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", id] });
      toast.success("Member removed");
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Workspace not found</p>
        <Button variant="link" onClick={() => navigate("/workspaces")}>Back to workspaces</Button>
      </div>
    );
  }

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const colors = ["bg-primary/20 text-primary", "bg-chart-2/20 text-chart-2", "bg-chart-3/20 text-chart-3", "bg-chart-4/20 text-chart-4", "bg-chart-5/20 text-chart-5"];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/workspaces")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-display">{workspace.name}</h1>
          {workspace.description && <p className="text-sm text-muted-foreground">{workspace.description}</p>}
        </div>
        <div className="flex -space-x-2">
          {members?.slice(0, 5).map((m: any, i: number) => (
            <Tooltip key={m.id}>
              <TooltipTrigger>
                <Avatar className={`h-8 w-8 border-2 border-background ${colors[i % colors.length]}`}>
                  <AvatarFallback className="text-xs">{getInitials(m.profile?.full_name)}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>{m.profile?.full_name || "Unknown"} • {m.role}</TooltipContent>
            </Tooltip>
          ))}
          {(members?.length ?? 0) > 5 && (
            <Avatar className="h-8 w-8 border-2 border-background bg-muted">
              <AvatarFallback className="text-xs">+{members!.length - 5}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>

      <Tabs defaultValue="summaries">
        <TabsList className="w-full">
          <TabsTrigger value="summaries" className="flex-1 gap-1"><FileText className="h-4 w-4" /> Shared Summaries</TabsTrigger>
          <TabsTrigger value="members" className="flex-1 gap-1"><Users className="h-4 w-4" /> Members</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 gap-1"><Activity className="h-4 w-4" /> Activity</TabsTrigger>
        </TabsList>

        {/* Shared Summaries Tab */}
        <TabsContent value="summaries" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={shareOpen} onOpenChange={setShareOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Share2 className="h-4 w-4" /> Share Summary</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Share a Summary</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <Select value={selectedSummary} onValueChange={setSelectedSummary}>
                    <SelectTrigger><SelectValue placeholder="Select a summary" /></SelectTrigger>
                    <SelectContent>
                      {mySummaries?.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.original_source?.slice(0, 50) || s.type} — {new Date(s.created_at).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button className="w-full" disabled={!selectedSummary || shareMutation.isPending} onClick={() => shareMutation.mutate()}>
                    {shareMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Share
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <AnimatePresence>
            {!sharedSummaries?.length ? (
              <Card className="p-8 text-center glass-card">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No summaries shared yet. Share one to get started!</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {sharedSummaries.map((ss: any, i: number) => (
                  <motion.div key={ss.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card className="p-4 glass-card">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{ss.summary?.type}</Badge>
                            <span className="text-xs text-muted-foreground">{ss.summary?.word_count} words</span>
                          </div>
                          <p className="text-sm font-medium truncate">{ss.summary?.original_source || "Untitled"}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{ss.summary?.summary_text?.slice(0, 200)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                        <span>Shared by {ss.sharer?.full_name || "Unknown"}</span>
                        <span>•</span>
                        <span>{new Date(ss.created_at).toLocaleDateString()}</span>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4 mt-4">
          {isOwner && (
            <div className="flex justify-end">
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Mail className="h-4 w-4" /> Invite Member</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Invite by Email</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-2">
                    <Input placeholder="user@example.com" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                    <p className="text-xs text-muted-foreground">The user must have an account on the platform.</p>
                    <Button className="w-full" disabled={!inviteEmail.trim() || inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>
                      {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Invite
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          <div className="space-y-2">
            {members?.map((m: any, i: number) => (
              <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                <Card className="p-4 glass-card flex items-center gap-4">
                  <Avatar className={`h-10 w-10 ${colors[i % colors.length]}`}>
                    <AvatarFallback>{getInitials(m.profile?.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{m.profile?.full_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.profile?.email}</p>
                  </div>
                  <Badge variant={m.role === "admin" ? "default" : "secondary"} className="gap-1">
                    {m.role === "admin" ? <Crown className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                    {m.role}
                  </Badge>
                  {isOwner && m.user_id !== user?.id && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeMutation.mutate(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-3 mt-4">
          {!activity?.length ? (
            <Card className="p-8 text-center glass-card">
              <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No activity yet</p>
            </Card>
          ) : (
            activity.map((a: any, i: number) => (
              <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <p className="text-sm flex-1">
                    <span className="font-medium">{a.profile?.full_name || "Someone"}</span>{" "}
                    {a.action === "invited_member" ? "invited a new member" : a.action === "shared_summary" ? "shared a summary" : a.action}
                  </p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
