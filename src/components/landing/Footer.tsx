import { FileText } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg animated-gradient">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-display gradient-text">Summarify AI</span>
          </div>

          <nav className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>

          <p className="text-sm text-muted-foreground">
            © 2025 Summarify AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
