
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create workspaces table
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Create workspace_members table
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Create shared_summaries table
CREATE TABLE public.shared_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  summary_id UUID REFERENCES public.summaries(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, summary_id)
);
ALTER TABLE public.shared_summaries ENABLE ROW LEVEL SECURITY;

-- Create workspace_activity table for realtime feed
CREATE TABLE public.workspace_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workspace_activity ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is member of workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  )
$$;

-- RLS: workspaces
CREATE POLICY "Members can view workspaces" ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), id) OR owner_id = auth.uid());

CREATE POLICY "Auth users can create workspaces" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update workspaces" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete workspaces" ON public.workspaces
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- RLS: workspace_members
CREATE POLICY "Members can view members" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Owners can manage members" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
    OR (auth.uid() = user_id)
  );

CREATE POLICY "Owners can remove members" ON public.workspace_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
    OR auth.uid() = user_id
  );

-- RLS: shared_summaries
CREATE POLICY "Members can view shared summaries" ON public.shared_summaries
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can share summaries" ON public.shared_summaries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = shared_by);

CREATE POLICY "Sharers can unshare" ON public.shared_summaries
  FOR DELETE TO authenticated
  USING (auth.uid() = shared_by);

-- RLS: workspace_activity
CREATE POLICY "Members can view activity" ON public.workspace_activity
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can insert activity" ON public.workspace_activity
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = user_id);

-- Enable realtime for shared_summaries and workspace_activity
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_summaries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_activity;
