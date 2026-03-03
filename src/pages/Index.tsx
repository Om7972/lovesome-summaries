import { useRef } from "react";
import { FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { UploadSection } from "@/components/landing/UploadSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { Footer } from "@/components/landing/Footer";
import { useAuth } from "@/context/AuthContext";

const Index = () => {
  const { user } = useAuth();
  const uploadRef = useRef<HTMLDivElement>(null);

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Sticky Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/30 backdrop-blur-xl bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl animated-gradient">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold font-display gradient-text">
                Summarify AI
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            </nav>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {user ? (
                <Button asChild variant="outline" className="glass-card text-sm">
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/login">Sign In</Link>
                  </Button>
                  <Button asChild size="sm" className="animated-gradient text-primary-foreground">
                    <Link to="/register">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Landing Content */}
      <main>
        <HeroSection onGetStarted={scrollToUpload} />
        <FeaturesSection />
        <div ref={uploadRef}>
          <UploadSection
            onFileSelect={() => {}}
            onVideoSelect={() => {}}
            onYouTubeSubmit={() => {}}
            isProcessing={false}
          />
        </div>
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <Footer />
      </main>
    </div>
  );
};

export default Index;
