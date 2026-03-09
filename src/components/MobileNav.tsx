import { Link, useLocation } from "react-router-dom";
import { FileText, LayoutDashboard, History, CreditCard, User, LogOut, Menu, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "History", icon: History, href: "/history" },
  { label: "Knowledge", icon: BookOpen, href: "/knowledge" },
  { label: "Pricing", icon: CreditCard, href: "/pricing" },
  { label: "Profile", icon: User, href: "/profile" },
];

export function MobileNav() {
  const location = useLocation();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="lg:hidden sticky top-0 z-50 border-b border-border/30 backdrop-blur-xl bg-background/60 px-4 py-3">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg animated-gradient">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold font-display gradient-text">Summarify AI</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <nav className="mt-8 space-y-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  onClick={() => { signOut(); setOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive w-full"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
