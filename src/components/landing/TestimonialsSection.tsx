import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Product Manager",
    avatar: "SC",
    quote: "Summarify AI saves me 3+ hours a day. I can quickly digest lengthy reports and make faster decisions.",
    stars: 5,
  },
  {
    name: "Alex Rivera",
    role: "Content Creator",
    avatar: "AR",
    quote: "The YouTube summarization is a game-changer. I research topics 10x faster for my videos now.",
    stars: 5,
  },
  {
    name: "Dr. Emily Park",
    role: "Research Scientist",
    avatar: "EP",
    quote: "The Q&A feature lets me drill into specific details without re-reading entire papers. Brilliant tool.",
    stars: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            Loved by Thousands
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See what our users are saying about Summarify AI
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="glass-card-strong p-8"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, si) => (
                  <Star key={si} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-foreground leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full animated-gradient flex items-center justify-center text-primary-foreground text-sm font-bold">
                  {t.avatar}
                </div>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
