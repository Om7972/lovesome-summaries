import { useState, useCallback, useMemo } from "react";
import { Network, Loader2, Info, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeGraphProps {
  text: string;
  summary: string;
}

interface GraphNode {
  id: string;
  label: string;
  description: string;
  category: string;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

const categoryColors: Record<string, string> = {
  concept: "hsl(var(--primary))",
  person: "hsl(var(--destructive))",
  topic: "hsl(var(--accent))",
  example: "#22c55e",
  definition: "#f59e0b",
};

export function KnowledgeGraph({ text, summary }: KnowledgeGraphProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [rawNodes, setRawNodes] = useState<GraphNode[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { toast } = useToast();

  const generate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-knowledge-graph", {
        body: { text, summary },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      const graphNodes: GraphNode[] = data.nodes || [];
      const graphEdges: GraphEdge[] = data.edges || [];
      setRawNodes(graphNodes);

      // Layout nodes in a circle
      const centerX = 400;
      const centerY = 300;
      const radius = Math.min(250, graphNodes.length * 30);

      const flowNodes: Node[] = graphNodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / graphNodes.length;
        return {
          id: n.id,
          position: {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          },
          data: { label: n.label },
          style: {
            background: categoryColors[n.category] || categoryColors.concept,
            color: "#fff",
            borderRadius: "12px",
            padding: "8px 16px",
            border: "none",
            fontSize: "12px",
            fontWeight: 600,
            boxShadow: `0 4px 12px ${categoryColors[n.category] || categoryColors.concept}40`,
            cursor: "pointer",
          },
        };
      });

      const flowEdges: Edge[] = graphEdges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        label: e.label,
        type: "default",
        animated: true,
        style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      setIsGenerated(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate graph", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const onNodeClick = useCallback((_: any, node: Node) => {
    const found = rawNodes.find(n => n.id === node.id);
    setSelectedNode(found || null);
  }, [rawNodes]);

  if (!isGenerated) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="p-4 rounded-full bg-accent/10">
              <Network className="h-10 w-10 text-accent" />
            </div>
            <h2 className="text-xl font-bold font-display">🧠 Knowledge Graph</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Visualize concepts and relationships as an interactive graph
            </p>
            <Button onClick={generate} disabled={isLoading} variant="outline" className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
              {isLoading ? "Building Graph..." : "Generate Knowledge Graph"}
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-6 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-accent/10">
            <Network className="h-5 w-5 text-accent" />
          </div>
          <h2 className="text-xl font-bold font-display">🧠 Knowledge Graph</h2>
          <Button variant="outline" size="sm" onClick={generate} disabled={isLoading} className="ml-auto gap-1.5 text-xs">
            Regenerate
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {Object.entries(categoryColors).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize text-muted-foreground">{cat}</span>
            </div>
          ))}
        </div>

        <div className="h-[500px] rounded-xl overflow-hidden border border-border/50 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="hsl(var(--muted-foreground))" gap={20} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(n) => n.style?.background as string || "#888"}
              style={{ borderRadius: "8px" }}
            />
          </ReactFlow>

          {/* Node detail popup */}
          <AnimatePresence>
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-4 right-4 max-w-sm mx-auto bg-card border border-border rounded-xl p-4 shadow-lg z-10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColors[selectedNode.category] }} />
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">{selectedNode.category}</span>
                    </div>
                    <h3 className="font-bold text-sm">{selectedNode.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{selectedNode.description}</p>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}
