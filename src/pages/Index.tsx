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
import logo from "@/assets/Lovesome.svg";

const Index = () => {
  const { user } = useAuth();
  const uploadRef = useRef<HTMLDivElement>(null);

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-hero">

      {/* ---------------- NAVBAR ---------------- */}
      <header className="sticky top-0 z-50 border-b border-border/30 backdrop-blur-xl bg-background/60">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">

          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Lovesome Logo" className="h-10 w-auto object-contain rounded-lg" />
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            {user ? (
              <Button asChild variant="outline">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>

        </div>
      </header>

      {/* ---------------- MAIN ---------------- */}
      <main>

        {/* Hero */}
        <HeroSection onGetStarted={scrollToUpload} />

        {/* Features */}
        <FeaturesSection />

        {/* Upload Section */}
        <div ref={uploadRef}>
          <UploadSection
            onFileSelect={() => {}}
            onVideoSelect={() => {}}
            onYouTubeSubmit={() => {}}
            isProcessing={false}
          />
        </div>

        {/* Pricing */}
        <PricingSection />

        {/* Testimonials */}
        <TestimonialsSection />

        {/* FAQ */}
        <FAQSection />

        {/* Footer */}
        <Footer />

      </main>
    </div>
  );
};

export default Index;