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
    const { question, context } = await req.json();

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
            content: 'You are a helpful assistant that answers questions based on the provided context. Answer accurately and concisely. If the context does not contain enough information to answer the question, say so. Provide specific details from the context when available.'
          },
          {
            role: 'user',
            content: `Based on the following context, please answer this question: ${question}\n\nContext:\n${contextToUse}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
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

    console.log('Answer generated successfully');

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
  }
});