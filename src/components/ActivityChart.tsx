import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface ActivityChartProps {
  summaries: Array<{ created_at: string; type: string }>;
}

export function ActivityChart({ summaries }: ActivityChartProps) {
  const chartData = useMemo(() => {
    const days: Record<string, { pdf: number; youtube: number; video: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      days[key] = { pdf: 0, youtube: 0, video: 0 };
    }

    const dayKeys = Object.keys(days);
    summaries.forEach((s) => {
      const d = new Date(s.created_at);
      const key = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      if (days[key]) {
        const t = s.type as "pdf" | "youtube" | "video";
        if (days[key][t] !== undefined) days[key][t]++;
      }
    });

    return dayKeys.map((name) => ({
      name: name.split(",")[0], // Just "Mon Mar 2"
      PDF: days[name].pdf,
      YouTube: days[name].youtube,
      Video: days[name].video,
    }));
  }, [summaries]);

  return (
    <Card className="glass-card-strong p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-bold font-display">Activity — Last 7 Days</h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem",
              fontSize: 12,
            }}
          />
          <Bar dataKey="PDF" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
          <Bar dataKey="YouTube" stackId="a" fill="hsl(var(--destructive))" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Video" stackId="a" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
