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
  console.error(`[summarize-video] Error: ${message}`);
  return jsonResponse({ success: false, message }, status);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { transcript, videoName, timestamps, length } = await req.json();

    // Input validation
    if (!transcript || typeof transcript !== 'string') {
      return errorResponse('Transcript is required', 400);
    }
    if (transcript.length > 500000) {
      return errorResponse('Transcript exceeds maximum allowed length', 413);
    }

    const summaryLength = ['short', 'medium', 'detailed'].includes(length) ? length : 'medium';
    console.log(`[summarize-video] Processing: ${videoName}, length: ${summaryLength}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return errorResponse('LOVABLE_API_KEY not configured', 503);
    }

    const lengthInstruction = {
      short: 'Keep the summary concise, under 200 words. Focus only on the most critical points.',
      medium: 'Create a balanced summary of 300-500 words covering all key topics.',
      detailed: 'Create a comprehensive summary of 600+ words with full detail on every topic discussed.',
    }[summaryLength];

    const prompt = `You are an expert video content analyzer. ${lengthInstruction}

Video: ${(videoName || 'Untitled').substring(0, 200)}

Your summary should include:
1. **Overview**: Brief introduction of the video's main purpose
2. **Main Topics**: Key subjects covered with detailed explanations
3. **Key Points**: Comprehensive breakdown of important information
4. **Detailed Insights**: Notable takeaways and analysis
5. **Action Items**: Specific recommendations or next actions mentioned

Format your response in clear sections with bullet points.

Transcript:
${transcript.substring(0, 100000)}`;

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
            content: 'You are an expert video content summarizer. Create well-structured summaries that capture all key points and actionable information.'
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[summarize-video] AI API error:', response.status, error);
      if (response.status === 429) return errorResponse('Rate limit exceeded. Please try again in a moment.', 429);
      if (response.status === 402) return errorResponse('AI usage limit reached. Please add credits to continue.', 402);
      return errorResponse(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;
    const elapsed = Date.now() - startTime;

    console.log(`[summarize-video] Success in ${elapsed}ms`);

    return jsonResponse({
      success: true,
      summary,
      timestamps: timestamps || [],
      meta: { processingTimeMs: elapsed, inputLength: transcript.length, summaryLength: summary.length },
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[summarize-video] Failed after ${elapsed}ms:`, error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error');
  }
});
