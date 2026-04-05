import { Link, useLocation } from "react-router-dom";
import { FileText, LayoutDashboard, History, CreditCard, User, LogOut, Sparkles, BookOpen, Brain, Headphones, Share2, Settings, Flame, GitCompareArrows, Lightbulb, Bookmark, Presentation, Clock, Wand2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Study Mode", icon: Brain, href: "/study" },
  { label: "Highlights", icon: Flame, href: "/highlights" },
  { label: "Compare Videos", icon: GitCompareArrows, href: "/compare" },
  { label: "Idea Generator", icon: Lightbulb, href: "/ideas" },
  { label: "Bookmarks", icon: Bookmark, href: "/bookmarks" },
  { label: "Slide Generator", icon: Presentation, href: "/slides" },
  { label: "Timeline", icon: Clock, href: "/timeline" },
  { label: "Podcasts", icon: Headphones, href: "/podcasts" },
  { label: "Knowledge Graph", icon: Share2, href: "/graph" },
  { label: "Knowledge Library", icon: BookOpen, href: "/knowledge" },
  { label: "History", icon: History, href: "/history" },
  { label: "Settings", icon: Settings, href: "/settings" },
  { label: "Pricing", icon: CreditCard, href: "/pricing" },
  { label: "Profile", icon: User, href: "/profile" },
];

export function DashboardSidebar() {
  const location = useLocation();
  const { signOut, profile, todaySummaryCount, canSummarize } = useAuth();

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border/50 bg-card/50 backdrop-blur-sm h-screen sticky top-0">
      <div className="p-6 border-b border-border/30">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl animated-gradient">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold font-display gradient-text">Summarify AI</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4">
        <div className="rounded-xl bg-muted/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Today's Usage</span>
            {profile?.is_premium && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Pro
              </span>
            )}
          </div>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold">{todaySummaryCount}</span>
            <span className="text-sm text-muted-foreground mb-0.5">/ {profile?.is_premium ? "∞" : "5"}</span>
          </div>
          {!profile?.is_premium && (
            <div className="w-full bg-muted rounded-full h-1.5">
              <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${Math.min((todaySummaryCount / 5) * 100, 100)}%` }} />
            </div>
          )}
          {!canSummarize && <p className="text-xs text-destructive">Daily limit reached</p>}
        </div>
      </div>

      <div className="p-4 border-t border-border/30 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">{profile?.email}</span>
          <ThemeToggle />
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </aside>
  );
}
