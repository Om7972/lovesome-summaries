import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const contentTypePrompts: Record<string, string> = {
  linkedin: `You are a LinkedIn content expert. Convert the summary into a professional LinkedIn post. Use a hook, key insights, and a call to action. Add relevant emojis. Keep it under 1300 characters. Use line breaks for readability.`,
  twitter: `You are a Twitter/X thread expert. Convert the summary into a viral Twitter thread (5-8 tweets). Start with a hook tweet. Number each tweet. Use emojis sparingly. Each tweet must be under 280 characters. Separate tweets with ---`,
  blog: `You are a professional blog writer. Convert the summary into a well-structured blog article with: an engaging title, introduction, 3-5 sections with headers (use ##), key takeaways, and a conclusion. Use markdown formatting. Aim for 800-1200 words.`,
  youtube_script: `You are a YouTube scriptwriter. Convert the summary into an engaging YouTube video script with: a hook intro (first 30 seconds), main content sections, transitions, and a strong outro with CTA. Include [B-ROLL], [GRAPHIC], and [CUT TO] cues. Aim for a 5-8 minute script.`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { summaryId, contentType, userId } = await req.json();

    if (!summaryId || !contentType || !userId) {
      return new Response(JSON.stringify({ success: false, message: 'summaryId, contentType, and userId are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = contentTypePrompts[contentType];
    if (!systemPrompt) {
      return new Response(JSON.stringify({ success: false, message: `Invalid content type: ${contentType}` }), {
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

    const { data: summary, error: dbError } = await supabase
      .from('summaries')
      .select('*')
      .eq('id', summaryId)
      .eq('user_id', userId)
      .single();

    if (dbError || !summary) {
      return new Response(JSON.stringify({ success: false, message: 'Summary not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyPoints = Array.isArray(summary.key_points) ? (summary.key_points as string[]).join('\n- ') : '';
    const userContent = `Title: ${summary.original_source}\n\nTL;DR: ${summary.tldr || ''}\n\nSummary:\n${summary.summary_text}\n\nKey Points:\n- ${keyPoints}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_content',
            description: 'Return the generated content with a title',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'A catchy title for the content' },
                content: { type: 'string', description: 'The full generated content in markdown' },
              },
              required: ['title', 'content'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'return_content' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ success: false, message: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ success: false, message: 'AI usage limit reached' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: false, message: 'AI API error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ success: false, message: 'Failed to generate content' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Save to DB
    const { error: insertError } = await supabase.from('content_outputs').insert({
      user_id: userId,
      summary_id: summaryId,
      type: contentType,
      title: result.title,
      content: result.content,
    });

    if (insertError) console.error('[generate-content] Insert error:', insertError);

    return new Response(JSON.stringify({
      success: true,
      title: result.title,
      content: result.content,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-content] Error:', error);
    return new Response(JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
