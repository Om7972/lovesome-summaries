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
    // Parse request body
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { transcription, videoUrl } = requestData;

    if (!transcription || transcription.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'No transcription provided. Please ensure the video was transcribed successfully.' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Summarizing video: ${videoUrl || 'Unknown'}, Transcription length: ${transcription.length}`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'OPENAI_API_KEY not configured. Please set it in your Supabase project settings under Edge Functions → Secrets.'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Truncate transcription if too long
    const maxLength = 100000;
    const textToSummarize = transcription.length > maxLength 
      ? transcription.substring(0, maxLength) + "\n\n[Note: Transcription truncated due to length. Summary based on first part of video.]"
      : transcription;

    console.log(`Calling OpenAI API with ${textToSummarize.length} characters...`);

    // Call OpenAI API for video summarization with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at summarizing video transcripts. Create comprehensive summaries with key topics, timestamps (if available), main points, and insights. Format your response in markdown with clear sections and headings.'
            },
            {
              role: 'user',
              content: `Please provide a comprehensive summary of the following video transcription${videoUrl ? ` from ${videoUrl}` : ''}. Include:\n1. Key Topics Discussed\n2. Main Points and Insights\n3. Important Details\n4. Conclusions or Takeaways\n\nIf timestamps are present in the transcription (format: [MM:SS]), include them in your summary to help users navigate to specific parts of the video.\n\nTranscription:\n\n${textToSummarize}`
            }
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }
        console.error('OpenAI API error:', errorData);
        return new Response(
          JSON.stringify({ 
            error: `OpenAI API error (${openaiResponse.status}): ${errorData.error?.message || openaiResponse.statusText}. Please check your API key and account status.`
          }),
          { 
            status: openaiResponse.status >= 500 ? 502 : 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const openaiData = await openaiResponse.json();
      const summary = openaiData.choices[0]?.message?.content;

      if (!summary) {
        return new Response(
          JSON.stringify({ error: 'No summary generated from OpenAI API' }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Video summary generated successfully');

      return new Response(
        JSON.stringify({ summary }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('OpenAI API request timed out');
        return new Response(
          JSON.stringify({ error: 'Request timed out. The video transcription might be too long. Please try with a shorter video.' }),
          { 
            status: 504,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('Error in summarize-video:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: `Failed to summarize video: ${errorMessage}. Please try again.`
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});