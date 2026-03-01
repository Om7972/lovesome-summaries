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
    const { transcript, videoName, timestamps } = await req.json();

    if (!transcript) {
      throw new Error('Transcript is required');
    }

    console.log('Summarizing video transcript:', videoName);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `You are an expert video content analyzer. Create a comprehensive, detailed summary of the following video transcript.

Video: ${videoName || 'Untitled'}

Your summary should include:
1. **Overview**: Brief introduction of the video's main purpose
2. **Main Topics**: List the key subjects covered with detailed explanations
3. **Key Points**: Comprehensive breakdown of all important information discussed
4. **Detailed Insights**: Notable takeaways, conclusions, and analysis
5. **Action Items**: Any specific recommendations, steps, or next actions mentioned

Format your response in clear sections with bullet points for easy reading.

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
            content: 'You are an expert video content summarizer. Create comprehensive, detailed, well-structured summaries that capture all key points, insights, and actionable information from video transcripts.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI API error:', response.status, error);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI usage limit reached. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    console.log('Video summary generated successfully');

    return new Response(
      JSON.stringify({ summary, timestamps: timestamps || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in summarize-video function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
