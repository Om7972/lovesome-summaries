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
  console.error(`[summarize-pdf] Error: ${message}`);
  return jsonResponse({ success: false, message }, status);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { text, fileName, length, language } = await req.json();

    if (!text || typeof text !== 'string') {
      return errorResponse('No text provided', 400);
    }
    if (text.length > 500000) {
      return errorResponse('Text exceeds maximum allowed length (500K chars)', 413);
    }

    const summaryLength = ['short', 'medium', 'detailed'].includes(length) ? length : 'medium';
    const targetLang = language || 'english';
    console.log(`[summarize-pdf] Processing: ${fileName}, length: ${summaryLength}, language: ${targetLang}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return errorResponse('LOVABLE_API_KEY not configured', 503);
    }

    const lengthInstruction = {
      short: 'Keep the summary concise, under 200 words. Focus only on the most critical points.',
      medium: 'Create a balanced summary of 300-500 words covering all key points.',
      detailed: 'Create a comprehensive, detailed summary of 600+ words capturing all important details, arguments, and insights.',
    }[summaryLength];

    const langInstruction = targetLang !== 'english'
      ? `\n\nIMPORTANT: Write the summary in ${targetLang}. The source text may be in any language, but your output MUST be in ${targetLang}.`
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
            content: `You are an expert document summarizer. ${lengthInstruction} Use clear sections, bullet points, and highlight critical information.${langInstruction}`
          },
          {
            role: 'user',
            content: `Please provide a comprehensive summary of the following document:\n\n${text.substring(0, 100000)}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[summarize-pdf] AI API error:', response.status, errorText);
      if (response.status === 429) return errorResponse('Rate limit exceeded. Please try again in a moment.', 429);
      if (response.status === 402) return errorResponse('AI usage limit reached. Please add credits to continue.', 402);
      return errorResponse(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;
    const elapsed = Date.now() - startTime;

    console.log(`[summarize-pdf] Success in ${elapsed}ms, summary length: ${summary.length} chars`);

    // If non-English, also generate English version
    let translatedSummary = '';
    if (targetLang !== 'english') {
      try {
        const transResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: 'Translate the following summary to English. Keep the same formatting and structure.' },
              { role: 'user', content: summary }
            ],
          }),
        });
        if (transResp.ok) {
          const transData = await transResp.json();
          translatedSummary = transData.choices[0].message.content;
        }
      } catch (e) {
        console.error('[summarize-pdf] Translation fallback failed:', e);
      }
    }

    return jsonResponse({
      success: true,
      summary,
      translatedSummary,
      language: targetLang,
      meta: {
        processingTimeMs: elapsed,
        inputLength: text.length,
        summaryLength: summary.length,
      }
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[summarize-pdf] Failed after ${elapsed}ms:`, error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error');
  }
});
