import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, ArrowRight, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function WorkspacesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [open, setOpen] = useState(false);

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      // Get workspaces where user is a member
      const { data: memberOf } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user!.id);

      const wsIds = memberOf?.map((m: any) => m.workspace_id) ?? [];

      // Also get owned workspaces
      const { data: owned } = await supabase
        .from("workspaces")
        .select("*")
        .eq("owner_id", user!.id);

      const ownedIds = owned?.map((w: any) => w.id) ?? [];
      const allIds = [...new Set([...wsIds, ...ownedIds])];

      if (allIds.length === 0) return [];

      const { data } = await supabase
        .from("workspaces")
        .select("*")
        .in("id", allIds)
        .order("created_at", { ascending: false });

      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: memberCounts } = useQuery({
    queryKey: ["workspace-member-counts"],
    queryFn: async () => {
      if (!workspaces?.length) return {};
      const counts: Record<string, number> = {};
      for (const ws of workspaces) {
        const { count } = await supabase
          .from("workspace_members")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", ws.id);
        counts[ws.id] = count ?? 0;
      }
      return counts;
    },
    enabled: !!workspaces?.length,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: ws, error } = await supabase
        .from("workspaces")
        .insert({ name: newName, description: newDesc, owner_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      // Add owner as admin member
      await supabase.from("workspace_members").insert({
        workspace_id: ws.id,
        user_id: user!.id,
        role: "admin",
      });

      return ws;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setNewName("");
      setNewDesc("");
      setOpen(false);
      toast.success("Workspace created!");
    },
    onError: () => toast.error("Failed to create workspace"),
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display gradient-text">Team Workspaces</h1>
          <p className="text-muted-foreground mt-1">Collaborate on summaries with your team</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <Input
                placeholder="Workspace name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={!newName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !workspaces?.length ? (
        <Card className="p-12 text-center glass-card">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No workspaces yet</h3>
          <p className="text-muted-foreground mb-4">Create a workspace to start collaborating with your team.</p>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Create Your First Workspace
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workspaces.map((ws: any, i: number) => (
            <motion.div
              key={ws.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/workspace/${ws.id}`}>
                <Card className="p-6 glass-card hover:shadow-xl transition-all group cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{ws.name}</h3>
                        {ws.owner_id === user?.id && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Crown className="h-3 w-3" /> Owner
                          </Badge>
                        )}
                      </div>
                      {ws.description && (
                        <p className="text-sm text-muted-foreground">{ws.description}</p>
                      )}
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{memberCounts?.[ws.id] ?? 0} members</span>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
