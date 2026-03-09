import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, contentType, timestamps } = await req.json();

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

    const isVideo = contentType === 'video' || contentType === 'youtube';
    const timestampContext = timestamps && timestamps.length > 0
      ? `\n\nTimestamps available:\n${timestamps.map((t: any) => `${t.time}: ${t.text}`).join('\n')}`
      : '';

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
            content: `You are an expert content analyzer. Detect the most important moments/sections in the content.${isVideo ? ' Include estimated timestamps in MM:SS format.' : ' Use section numbers or paragraph references.'}`
          },
          {
            role: 'user',
            content: `Analyze this content and find the key moments:\n\n${text.substring(0, 60000)}${timestampContext}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'detect_highlights',
            description: 'Detect key moments and important sections in content',
            parameters: {
              type: 'object',
              properties: {
                highlights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      timestamp: { type: 'string', description: 'Timestamp MM:SS for videos, or section reference for documents' },
                      description: { type: 'string', description: 'Brief description of this key moment' },
                      importance: { type: 'string', enum: ['high', 'medium', 'low'] }
                    },
                    required: ['timestamp', 'description', 'importance'],
                    additionalProperties: false
                  }
                }
              },
              required: ['highlights'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'detect_highlights' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[detect-highlights] AI error:', response.status, errorText);
      if (response.status === 429) return new Response(JSON.stringify({ success: false, message: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ success: false, message: 'AI usage limit reached' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: false, message: 'AI API error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(JSON.stringify({ success: false, message: 'Failed to detect highlights' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      success: true,
      highlights: result.highlights || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[detect-highlights] Error:', error);
    return new Response(JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
