import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 500) {
  console.error(`[generate-smart-notes] Error: ${message}`);
  return jsonResponse({ success: false, message }, status);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { text, summary } = await req.json();

    if (!text || typeof text !== 'string') {
      return errorResponse('Text content is required', 400);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return errorResponse('LOVABLE_API_KEY not configured', 503);
    }

    const contextText = text.substring(0, 80000);
    const summaryContext = summary ? `\n\nExisting summary:\n${summary.substring(0, 5000)}` : '';

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
            content: 'You are an expert content analyst. Extract structured insights from documents and videos. Always respond using the provided tool.'
          },
          {
            role: 'user',
            content: `Analyze this content and extract key points, actionable insights, important quotes, and a TL;DR.${summaryContext}\n\nFull content:\n${contextText}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_smart_notes',
              description: 'Extract structured notes from the content',
              parameters: {
                type: 'object',
                properties: {
                  tldr: {
                    type: 'string',
                    description: 'A 1-2 sentence TL;DR of the entire content'
                  },
                  key_points: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '5-10 key bullet points capturing the most important information'
                  },
                  insights: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '3-5 actionable insights or takeaways the reader can apply'
                  },
                  quotes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '3-5 important or notable direct quotes from the content'
                  }
                },
                required: ['tldr', 'key_points', 'insights', 'quotes'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_smart_notes' } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-smart-notes] AI API error:', response.status, errorText);
      if (response.status === 429) return errorResponse('Rate limit exceeded. Please try again.', 429);
      if (response.status === 402) return errorResponse('AI usage limit reached.', 402);
      return errorResponse(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return errorResponse('Failed to extract structured notes');
    }

    const notes = JSON.parse(toolCall.function.arguments);
    const elapsed = Date.now() - startTime;

    console.log(`[generate-smart-notes] Success in ${elapsed}ms`);

    return jsonResponse({
      success: true,
      tldr: notes.tldr || '',
      key_points: notes.key_points || [],
      insights: notes.insights || [],
      quotes: notes.quotes || [],
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[generate-smart-notes] Failed after ${elapsed}ms:`, error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error');
  }
});
