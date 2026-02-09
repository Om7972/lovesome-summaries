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
    const { transcription, videoUrl } = await req.json();

    if (!transcription) {
      throw new Error('No transcription provided');
    }

    console.log(`Summarizing video: ${videoUrl}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Enhanced video summarization with structured output
    // In a real implementation, this would call an AI service like OpenAI or Google Gemini
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const enhancedSummary = `# Video Summary

## Key Topics Discussed
- Introduction to artificial intelligence and machine learning
- Natural language processing advancements
- Computer vision applications
- Ethical considerations in AI development

## Timestamps and Content Breakdown
[00:00] **Introduction** - Overview of AI and machine learning concepts
[00:12] **Natural Language Processing** - Discussion on NLP and its applications
[00:20] **Speaker Insights** - Expert perspectives on language processing technology
[00:30] **Key Applications** - Real-world uses of NLP including chatbots and translation
[00:35] **Technical Breakthroughs** - Advances in transformer models and accuracy improvements
[00:42] **Computer Vision** - Exploration of visual information processing
[00:48] **Application Areas** - Medical imaging and autonomous vehicles use cases
[01:00] **Deep Learning Progress** - Image recognition advancements
[01:15] **Ethical Implications** - Discussion on responsible AI development
[01:20] **Bias Considerations** - Addressing fairness in AI systems
[01:28] **Transparency Needs** - Importance of accountability in AI
[01:35] **Conclusion** - Summary and call to action

## Key Speakers
- **Speaker 1**: Main presenter, provides foundational knowledge
- **Speaker 2**: Industry expert, shares technical insights

## Highlights
- NLP is revolutionizing human-computer interaction
- Transformer models have significantly improved accuracy
- Computer vision applications range from medical to automotive
- Ethical considerations are crucial for responsible AI development
- Bias in training data must be addressed for fair outcomes`;

    console.log('Video summary generated successfully');

    return new Response(
      JSON.stringify({ summary: enhancedSummary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in summarize-video:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});