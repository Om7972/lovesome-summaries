import logo from "@/assets/Lovesome.svg";

export function Footer() {
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center">
            <img src={logo} alt="Lovesome Logo" className="h-10 w-auto object-contain rounded-lg" />
          </div>

          <nav className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>

          <p className="text-sm text-muted-foreground">
            © 2026 Lovesome Summaries. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
