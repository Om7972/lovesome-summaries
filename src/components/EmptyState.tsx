import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
      <Card className="glass-card p-16 text-center">
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex justify-center mb-6"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-150" />
            <div className="relative p-5 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
              <Icon className="h-10 w-10 text-primary/60" />
            </div>
          </div>
        </motion.div>
        <motion.h3
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-lg font-bold font-display mb-2"
        >
          {title}
        </motion.h3>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-sm text-muted-foreground max-w-sm mx-auto"
        >
          {description}
        </motion.p>
        {action && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mt-6"
          >
            {action}
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}

export function SummaryListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="glass-card p-6">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function GeneratingSkeleton({ message = "Generating..." }: { message?: string }) {
  return (
    <Card className="glass-card p-16 text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="mx-auto mb-6 w-fit"
      >
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent" />
      </motion.div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-48 mx-auto" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </Card>
  );
}
