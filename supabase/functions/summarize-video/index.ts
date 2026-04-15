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
  console.error(`[summarize-video] Error: ${message}`);
  return jsonResponse({ success: false, message }, status);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
    const { transcript, videoName, timestamps } = await req.json();
=======
    const { transcript, videoName, timestamps, length, language } = await req.json();
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d

    if (!transcript || typeof transcript !== 'string') {
      return errorResponse('Transcript is required', 400);
    }
    if (transcript.length > 500000) {
      return errorResponse('Transcript exceeds maximum allowed length', 413);
    }

    const summaryLength = ['short', 'medium', 'detailed'].includes(length) ? length : 'medium';
    const targetLang = language || 'english';
    console.log(`[summarize-video] Processing: ${videoName}, length: ${summaryLength}, language: ${targetLang}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return errorResponse('LOVABLE_API_KEY not configured', 503);
    }

    const lengthInstruction = {
      short: 'Keep the summary concise, under 200 words. Focus only on the most critical points.',
      medium: 'Create a balanced summary of 300-500 words covering all key topics.',
      detailed: 'Create a comprehensive summary of 600+ words with full detail on every topic discussed.',
    }[summaryLength];

    const langInstruction = targetLang !== 'english'
      ? `\n\nIMPORTANT: Write the entire summary in ${targetLang}.`
      : '';

    const prompt = `You are an expert video content analyzer. ${lengthInstruction}${langInstruction}

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
        console.error('[summarize-video] Translation fallback failed:', e);
      }
    }

    console.log(`[summarize-video] Success in ${elapsed}ms`);

    return jsonResponse({
      success: true,
      summary,
      translatedSummary,
      language: targetLang,
      timestamps: timestamps || [],
      meta: { processingTimeMs: elapsed, inputLength: transcript.length, summaryLength: summary.length },
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[summarize-video] Failed after ${elapsed}ms:`, error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error');
  }
});
>>>>>>> 1c8413d2115a076c529557bd6387fa5a773199ca
