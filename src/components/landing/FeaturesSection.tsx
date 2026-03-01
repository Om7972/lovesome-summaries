import { motion } from "framer-motion";
import { FileText, Video, MessageSquare, Zap, Shield, Download } from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "PDF Summarization",
    desc: "Extract key insights from any PDF document instantly with AI-powered analysis.",
  },
  {
    icon: Video,
    title: "Video & YouTube",
    desc: "Summarize videos and YouTube content with automatic transcript extraction.",
  },
  {
    icon: MessageSquare,
    title: "Interactive Q&A",
    desc: "Ask follow-up questions about your content and get precise, contextual answers.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    desc: "Get comprehensive summaries in seconds, not minutes. Save hours of reading time.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    desc: "Your documents are processed securely and never stored on our servers.",
  },
  {
    icon: Download,
    title: "Export Anywhere",
    desc: "Download your summaries as text files and share them with your team.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function FeaturesSection() {
  return (
    <section className="py-24 relative" id="features">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            Everything You Need
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful AI tools to transform your content into actionable insights
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="group glass-card-strong p-8 hover:shadow-glow transition-all duration-300 hover:-translate-y-1"
            >
              <div className="p-3 rounded-xl animated-gradient w-fit mb-5">
                <feature.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold font-display mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
