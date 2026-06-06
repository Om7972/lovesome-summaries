import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What file formats does Lovesome Summaries support?",
    a: "We support PDF documents, video files (MP4, MOV, AVI, MKV, WebM), and YouTube links. Simply upload your file or paste a YouTube URL to get started.",
  },
  {
    q: "How accurate are the AI summaries?",
    a: "Our summaries are powered by state-of-the-art AI models that capture key points, arguments, and insights with high accuracy. You can also ask follow-up questions for deeper understanding.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. Your documents are processed in real-time and are not stored on our servers. All data transmission is encrypted end-to-end.",
  },
  {
    q: "Can I use Lovesome Summaries for free?",
    a: "Absolutely! Our free plan includes 5 summaries per day with full access to PDF and YouTube summarization, interactive Q&A, and text export.",
  },
  {
    q: "How does the YouTube summarization work?",
    a: "We extract captions from YouTube videos automatically and use AI to create comprehensive summaries with timestamps, so you can jump to the most relevant parts.",
  },
  {
    q: "Can I ask questions about my documents?",
    a: "Yes! After generating a summary, you can ask unlimited follow-up questions. Our AI will answer based on the full content of your document or video.",
  },
];

export function FAQSection() {
  return (
    <section className="py-24 relative" id="faq">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about Lovesome Summaries
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto glass-card-strong p-8"
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left font-display font-semibold hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
