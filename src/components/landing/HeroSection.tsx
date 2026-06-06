import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface HeroSectionProps {
  onGetStarted: () => void;
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  const { user } = useAuth();
  return (
    <section className="relative overflow-hidden pt-20 pb-32">
      {/* Mesh background */}
      <div className="absolute inset-0 mesh-bg" />
      
      {/* Floating orbs */}
      <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full bg-primary/10 blur-[100px] animate-float" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 rounded-full bg-primary-glow/10 blur-[120px] animate-float" style={{ animationDelay: "2s" }} />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-8"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Lovesome Summaries · Powered by Advanced AI</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="text-5xl md:text-7xl font-extrabold font-display tracking-tight mb-6"
          >
            Transform Content
            <span className="block gradient-text">Into Clarity</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Upload PDFs, videos, or YouTube links and get instant AI-powered summaries, 
            key insights, and interactive Q&A — all in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              size="lg"
              asChild
              className="animated-gradient text-primary-foreground px-8 py-6 text-base font-semibold btn-glow group"
            >
              <Link to={user ? "/dashboard" : "/register"}>
                {user ? "Go to Dashboard" : "Get Started Free"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={onGetStarted}
              className="px-8 py-6 text-base glass-card hover:bg-muted/50"
            >
              See How It Works
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
