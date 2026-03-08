import { useState } from "react";
import {
  Lightbulb, ListChecks, Quote, Zap, ChevronDown, Loader2, RefreshCw
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";

interface SmartNotes {
  tldr: string;
  key_points: string[];
  insights: string[];
  quotes: string[];
}

interface SmartNotesDisplayProps {
  notes: SmartNotes | null;
  isLoading: boolean;
  onRegenerate?: () => void;
}

const sectionConfig = [
  {
    key: "key_points" as const,
    title: "Key Points",
    icon: ListChecks,
    emptyText: "No key points extracted",
    colorClass: "text-primary",
    bgClass: "bg-primary/10",
  },
  {
    key: "insights" as const,
    title: "Actionable Insights",
    icon: Lightbulb,
    emptyText: "No insights extracted",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
  },
  {
    key: "quotes" as const,
    title: "Important Quotes",
    icon: Quote,
    emptyText: "No quotes extracted",
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
  },
];

export const SmartNotesDisplay = ({ notes, isLoading, onRegenerate }: SmartNotesDisplayProps) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    key_points: true,
    insights: true,
    quotes: true,
  });

  if (isLoading) {
    return (
      <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="relative">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="absolute inset-0 h-10 w-10 rounded-full bg-primary/20 animate-pulse" />
          </div>
          <div className="text-center">
            <p className="font-semibold font-display">Generating Smart Notes...</p>
            <p className="text-sm text-muted-foreground mt-1">Extracting key points, insights & quotes</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!notes) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold font-display">AI Smart Notes</h2>
          </div>
          {onRegenerate && (
            <Button variant="outline" size="sm" onClick={onRegenerate} className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </Button>
          )}
        </div>

        {/* TL;DR */}
        {notes.tldr && (
          <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">TL;DR</p>
            <p className="text-sm leading-relaxed text-foreground">{notes.tldr}</p>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-4">
          {sectionConfig.map((section) => {
            const items = notes[section.key];
            return (
              <Collapsible
                key={section.key}
                open={expandedSections[section.key]}
                onOpenChange={(open) =>
                  setExpandedSections((prev) => ({ ...prev, [section.key]: open }))
                }
              >
                <CollapsibleTrigger className="flex items-center gap-3 w-full text-left py-2 group">
                  <div className={`p-1.5 rounded-lg ${section.bgClass}`}>
                    <section.icon className={`h-4 w-4 ${section.colorClass}`} />
                  </div>
                  <span className="font-semibold text-sm flex-1">{section.title}</span>
                  <span className="text-xs text-muted-foreground mr-2">{items.length} items</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <AnimatePresence>
                    <div className="pl-10 space-y-2 pb-2">
                      {items.length > 0 ? (
                        items.map((item, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            {section.key === "quotes" ? (
                              <blockquote className="border-l-2 border-emerald-500/40 pl-3 py-1 text-sm text-muted-foreground italic">
                                "{item}"
                              </blockquote>
                            ) : (
                              <div className="flex gap-2 text-sm">
                                <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
                                <span className="text-foreground leading-relaxed">{item}</span>
                              </div>
                            )}
                          </motion.div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">{section.emptyText}</p>
                      )}
                    </div>
                  </AnimatePresence>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
};
