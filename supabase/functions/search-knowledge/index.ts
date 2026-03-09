import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, userId } = await req.json();

    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ success: false, message: 'Question is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ success: false, message: 'User ID is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, message: 'LOVABLE_API_KEY not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's summaries for context
    const { data: summaries, error: dbError } = await supabase
      .from('summaries')
      .select('id, original_source, summary_text, type, created_at, key_points, insights, tldr')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (dbError) {
      console.error('[search-knowledge] DB error:', dbError);
      return new Response(JSON.stringify({ success: false, message: 'Database error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!summaries || summaries.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        answer: "You don't have any summaries yet. Create some summaries first, then I can search across your knowledge base.",
        sources: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context from all summaries
    const knowledgeBase = summaries.map((s, i) => {
      const kp = Array.isArray(s.key_points) ? (s.key_points as string[]).join('; ') : '';
      return `[${i + 1}] "${s.original_source}" (${s.type}, ${new Date(s.created_at).toLocaleDateString()}):\nTL;DR: ${s.tldr || 'N/A'}\nSummary: ${(s.summary_text || '').substring(0, 1000)}\nKey Points: ${kp}`;
    }).join('\n\n---\n\n');

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
            content: `You are a personal knowledge assistant. The user has a library of summarized documents and videos. Answer their question using ONLY information from their knowledge base. Cite sources by their title. If the answer is not in the knowledge base, say so. Format with markdown.`
          },
          {
            role: 'user',
            content: `My knowledge base:\n\n${knowledgeBase.substring(0, 80000)}\n\nQuestion: ${question}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'answer_with_sources',
            description: 'Answer the question and cite relevant sources',
            parameters: {
              type: 'object',
              properties: {
                answer: { type: 'string', description: 'Detailed answer using markdown formatting' },
                source_indices: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Indices (1-based) of the summaries used to answer'
                }
              },
              required: ['answer', 'source_indices'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'answer_with_sources' } }
      }),
    });

    if (!response.ok) {
      console.error('[search-knowledge] AI error:', response.status);
      if (response.status === 429) return new Response(JSON.stringify({ success: false, message: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ success: false, message: 'AI usage limit reached' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: false, message: 'AI API error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ success: false, message: 'Failed to search knowledge' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    const sources = (result.source_indices || []).map((idx: number) => {
      const s = summaries[idx - 1];
      if (!s) return null;
      return { id: s.id, title: s.original_source, type: s.type, date: s.created_at };
    }).filter(Boolean);

    return new Response(JSON.stringify({
      success: true,
      answer: result.answer,
      sources,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[search-knowledge] Error:', error);
    return new Response(JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
