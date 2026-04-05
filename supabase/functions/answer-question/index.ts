import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 500) {
  console.error(`[answer-question] Error: ${message}`);
  return jsonResponse({ success: false, message }, status);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { question, context } = await req.json();

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return errorResponse('Question is required', 400);
    }
    if (context !== undefined && typeof context !== 'string') {
      return errorResponse('Context must be a string', 400);
    }
    if (question.length > 50000) {
      return errorResponse('Question is too long (max 50000 characters)', 400);
    }

    console.log(`[answer-question] Processing: ${question.substring(0, 100)}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return errorResponse('LOVABLE_API_KEY not configured', 503);
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
            content: 'You are a helpful AI assistant that answers questions about documents. Provide clear, concise, and accurate answers based on the document context provided. If the answer is not in the context, say so.'
          },
          {
            role: 'user',
            content: context ? `Context from document:\n\n${context.substring(0, 40000)}\n\nQuestion: ${question}` : question
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[answer-question] AI API error:', response.status, errorText);
      if (response.status === 429) return errorResponse('Rate limit exceeded. Please try again in a moment.', 429);
      if (response.status === 402) return errorResponse('AI usage limit reached. Please add credits to continue.', 402);
      return errorResponse(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;
    const elapsed = Date.now() - startTime;

    console.log(`[answer-question] Success in ${elapsed}ms`);

    return jsonResponse({ success: true, answer });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[answer-question] Failed after ${elapsed}ms:`, error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error');
  }
});
