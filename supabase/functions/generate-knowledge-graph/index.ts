import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, summary } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ success: false, message: 'Text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, message: 'LOVABLE_API_KEY not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert knowledge graph builder. Extract entities and their relationships from content to build a visual knowledge map.'
          },
          {
            role: 'user',
            content: `Extract a knowledge graph from this content:\n\nSummary: ${(summary || '').substring(0, 5000)}\n\nFull text: ${text.substring(0, 40000)}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'build_knowledge_graph',
            description: 'Build a knowledge graph with nodes and edges from content',
            parameters: {
              type: 'object',
              properties: {
                nodes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      label: { type: 'string', description: 'Short name for the concept' },
                      description: { type: 'string', description: 'One sentence explanation' },
                      category: { type: 'string', enum: ['concept', 'person', 'topic', 'example', 'definition'] }
                    },
                    required: ['id', 'label', 'description', 'category'],
                    additionalProperties: false
                  },
                  description: 'Generate 8-15 key entities/concepts as nodes'
                },
                edges: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      source: { type: 'string', description: 'Source node id' },
                      target: { type: 'string', description: 'Target node id' },
                      label: { type: 'string', description: 'Relationship type e.g. "is part of", "leads to", "uses"' }
                    },
                    required: ['source', 'target', 'label'],
                    additionalProperties: false
                  },
                  description: 'Connections between nodes'
                }
              },
              required: ['nodes', 'edges'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'build_knowledge_graph' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-knowledge-graph] AI error:', response.status, errorText);
      if (response.status === 429) return new Response(JSON.stringify({ success: false, message: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ success: false, message: 'AI usage limit reached' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: false, message: 'AI API error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(JSON.stringify({ success: false, message: 'Failed to generate knowledge graph' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const graph = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      success: true,
      nodes: graph.nodes || [],
      edges: graph.edges || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-knowledge-graph] Error:', error);
    return new Response(JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
