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

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Enhanced prompt for better video summarization
    const prompt = `You are an expert video content analyzer. Create a comprehensive, detailed summary of the following video transcript.

Video: ${videoName || 'Untitled'}

Your summary should include:
1. **Overview**: Brief introduction of the video's main purpose
2. **Main Topics**: List the key subjects covered with detailed explanations
3. **Key Points**: Comprehensive breakdown of all important information discussed
4. **Detailed Insights**: Notable takeaways, conclusions, and analysis
5. **Action Items**: Any specific recommendations, steps, or next actions mentioned
6. **Additional Context**: Any supporting details, examples, or data provided

Format your response in clear sections with bullet points and sub-points for easy reading. Be thorough and capture all significant content.

Transcript:
${transcript.substring(0, 100000)}`;

    // Call OpenAI for summarization
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are an expert video content summarizer. Create comprehensive, detailed, well-structured summaries that capture all key points, insights, and actionable information from video transcripts. Be thorough and informative.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    console.log('Video summary generated successfully');

    return new Response(
      JSON.stringify({ 
        summary,
        timestamps: timestamps || []
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in summarize-video function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
