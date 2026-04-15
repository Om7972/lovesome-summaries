import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, summary, quizType } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ success: false, message: 'Text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, message: 'LOVABLE_API_KEY not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const type = quizType || 'mixed'; // flashcard, quiz, mixed

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
            content: 'You are an expert educator that creates learning materials from content.'
          },
          {
            role: 'user',
            content: `Based on this content, generate learning materials.\n\nSummary: ${(summary || '').substring(0, 5000)}\n\nFull text: ${text.substring(0, 50000)}`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_learning_materials',
            description: 'Generate quiz questions, flashcards, and study notes from content',
            parameters: {
              type: 'object',
              properties: {
                flashcards: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string' },
                      answer: { type: 'string' }
                    },
                    required: ['question', 'answer'],
                    additionalProperties: false
                  },
                  description: 'Generate 8-10 flashcards with question/answer pairs'
                },
                quiz_questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string' },
                      options: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '4 multiple choice options'
                      },
                      correct_answer: { type: 'string' },
                      explanation: { type: 'string' }
                    },
                    required: ['question', 'options', 'correct_answer', 'explanation'],
                    additionalProperties: false
                  },
                  description: 'Generate 5-8 multiple choice quiz questions'
                },
                study_notes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Generate 10-15 concise study notes as bullet points'
                }
              },
              required: ['flashcards', 'quiz_questions', 'study_notes'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_learning_materials' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-quiz] AI error:', response.status, errorText);
      if (response.status === 429) return new Response(JSON.stringify({ success: false, message: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ success: false, message: 'AI usage limit reached' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: false, message: 'AI API error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(JSON.stringify({ success: false, message: 'Failed to generate learning materials' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const materials = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      success: true,
      flashcards: materials.flashcards || [],
      quiz_questions: materials.quiz_questions || [],
      study_notes: materials.study_notes || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-quiz] Error:', error);
    return new Response(JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
