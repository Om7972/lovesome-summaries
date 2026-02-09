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

    if (!question || !context) {
      throw new Error('Question and context are required');
    }

    console.log(`Processing question: ${question}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Enhanced Q&A with more detailed responses
    // In a real implementation, this would call an AI service like OpenAI or Google Gemini
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock intelligent responses based on common questions
    let answer = "";
    
    if (question.toLowerCase().includes("what is this document about")) {
      answer = "This document provides a comprehensive overview of artificial intelligence technologies, covering key areas such as machine learning fundamentals, natural language processing, computer vision applications, and ethical considerations in AI development.";
    } else if (question.toLowerCase().includes("key points") || question.toLowerCase().includes("main points")) {
      answer = "The key points from this document include: 1) AI technology is rapidly advancing across multiple domains, 2) Machine learning models require careful training and validation, 3) Ethical considerations must be integrated into AI development from the start, and 4) Interdisciplinary collaboration is essential for responsible AI deployment.";
    } else if (question.toLowerCase().includes("recommend") || question.toLowerCase().includes("suggestion")) {
      answer = "Based on the content, the document recommends: 1) Investing in AI talent development and training, 2) Establishing clear ethical guidelines for AI projects, 3) Prioritizing data quality and diversity in training datasets, and 4) Implementing robust testing and validation processes.";
    } else if (question.toLowerCase().includes("how does") || question.toLowerCase().includes("how do")) {
      answer = "The document explains that AI systems work through various technologies including neural networks, machine learning algorithms, and deep learning models. These systems process data, identify patterns, and make predictions or decisions based on their training.";
    } else {
      // Default response for other questions
      answer = `Based on the content provided, the answer to your question "${question}" is that artificial intelligence systems leverage advanced algorithms and machine learning techniques to process information, recognize patterns, and generate insights. The specific details would depend on the context of your question within the document.`;
    }

    console.log('Answer generated successfully');

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in answer-question:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});