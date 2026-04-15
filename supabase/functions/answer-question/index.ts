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

<<<<<<< HEAD
    if (!question) {
      throw new Error('Question is required');
    }

    if (!context || context.trim().length === 0) {
      throw new Error('Context is required to answer questions');
    }

    console.log(`Processing question: ${question.substring(0, 100)}...`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured. Please set it in your Supabase project settings.');
    }

    // Truncate context if too long
    const maxContextLength = 30000;
    const contextToUse = context.length > maxContextLength 
      ? context.substring(0, maxContextLength) + "\n\n[Context truncated due to length...]"
      : context;

    console.log(`Calling OpenAI API for Q&A with context length: ${contextToUse.length}`);

    // Call OpenAI API for Q&A with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
=======
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
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
<<<<<<< HEAD
        model: 'gpt-4o',
=======
        model: 'google/gemini-3-flash-preview',
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that answers questions based on the provided context. Answer accurately and concisely. If the context does not contain enough information to answer the question, say so. Provide specific details from the context when available.'
          },
          {
            role: 'user',
<<<<<<< HEAD
            content: `Based on the following context, please answer this question: ${question}\n\nContext:\n${contextToUse}`
=======
            content: context ? `Context from document:\n\n${context.substring(0, 40000)}\n\nQuestion: ${question}` : question
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

<<<<<<< HEAD
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
    const answer = openaiData.choices[0]?.message?.content;

    if (!answer) {
      return new Response(
        JSON.stringify({ error: 'No answer generated from OpenAI API' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
=======
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
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d

    console.log(`[answer-question] Success in ${elapsed}ms`);

<<<<<<< HEAD
    return new Response(
      JSON.stringify({ answer }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in answer-question:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'Request timed out. Please try again with a shorter question or context.' }),
        { 
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: `Failed to answer question: ${errorMessage}. Please try again.`
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
=======
    return jsonResponse({ success: true, answer });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[answer-question] Failed after ${elapsed}ms:`, error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error');
>>>>>>> 86ffafd40c71b15bd4ba904e44079736d9f3772d
  }
});