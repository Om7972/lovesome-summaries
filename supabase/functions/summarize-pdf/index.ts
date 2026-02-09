import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
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

    const { text, fileName, pdfBase64 } = requestData;

    // Validate input
    if (!pdfBase64 && !text) {
      return new Response(
        JSON.stringify({ error: 'Either pdfBase64 or text must be provided' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get text from either direct text or extract from base64 PDF
    let extractedText = text || '';

    // If PDF is provided as base64, extract text from it
    if (pdfBase64 && !text) {
      try {
        console.log('Starting PDF text extraction...');
        
        // Decode base64 PDF - handle data URL format
        let base64Data = pdfBase64;
        if (pdfBase64.includes(',')) {
          base64Data = pdfBase64.split(',')[1];
        }
        
        const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        console.log(`PDF size: ${pdfBytes.length} bytes`);
        
        // Convert to string for text extraction
        const pdfString = new TextDecoder('latin1', { fatal: false }).decode(pdfBytes);
        
        // Improved PDF text extraction with multiple methods
        const textMatches: string[] = [];
        
        // Method 1: Extract text from text objects (most common) - improved regex
        const textObjectRegex = /\((.*?)\)/g;
        let match;
        let matchCount = 0;
        while ((match = textObjectRegex.exec(pdfString)) !== null && matchCount < 10000) {
          matchCount++;
          const textContent = match[1];
          if (!textContent || textContent.length < 2) continue;
          
          // Decode PDF escape sequences
          let decoded = textContent
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, ' ')
            .replace(/\\t/g, ' ')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\');
          
          // Decode octal sequences
          decoded = decoded.replace(/\\([0-7]{1,3})/g, (_, oct) => {
            try {
              return String.fromCharCode(parseInt(oct, 8));
            } catch {
              return '';
            }
          });
          
          // Filter out noise
          const trimmed = decoded.trim();
          if (trimmed.length > 2 && 
              !trimmed.match(/^[0-9\s\.\-]+$/) && 
              /[a-zA-Z]/.test(trimmed)) {
            textMatches.push(trimmed);
          }
        }
        
        console.log(`Method 1: Found ${textMatches.length} text matches`);
        
        // Method 2: Extract from text blocks (BT/ET)
        if (textMatches.length < 20) {
          const textBlockRegex = /BT[\s\S]{0,5000}?ET/g;
          const textBlocks = pdfString.match(textBlockRegex) || [];
          console.log(`Found ${textBlocks.length} text blocks`);
          
          for (const block of textBlocks) {
            const blockMatches = block.match(/\((.*?)\)/g) || [];
            for (const blockMatch of blockMatches) {
              const content = blockMatch.replace(/[()]/g, '').trim();
              if (content.length > 2 && /[a-zA-Z]/.test(content)) {
                textMatches.push(content);
              }
            }
          }
        }
        
        // Combine and clean extracted text
        extractedText = textMatches
          .filter(t => t && t.length > 1)
          .join(' ')
          .replace(/\s+/g, ' ')
          .replace(/[^\x20-\x7E\n\r]/g, ' ') // Remove non-printable chars except newlines
          .trim();
        
        console.log(`Extracted text length: ${extractedText.length} characters`);
        
        // Validate extracted text
        if (!extractedText || extractedText.length < 50) {
          // Try one more method: look for readable text patterns
          const words = pdfString.match(/[A-Za-z]{3,}/g) || [];
          if (words.length > 20) {
            extractedText = words.join(' ');
            console.log(`Fallback method: Extracted ${words.length} words`);
          }
        }
        
        // Final validation
        if (!extractedText || extractedText.length < 50) {
          return new Response(
            JSON.stringify({ 
              error: 'Could not extract sufficient text from PDF. The PDF might be image-based, scanned, or password-protected. Please ensure the PDF contains selectable text.'
            }),
            { 
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        console.log(`Successfully extracted ${extractedText.length} characters from PDF`);
      } catch (error) {
        console.error('Error extracting text from PDF:', error);
        return new Response(
          JSON.stringify({ 
            error: `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the PDF contains readable text.`
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'No text found in PDF. Please ensure the PDF contains readable text.' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Processing PDF: ${fileName || 'Unknown'}, Text length: ${extractedText.length}`);

    // Get OpenAI API key
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

    // Truncate text if too long (OpenAI has token limits)
    // Use a safe limit for GPT-4 (roughly 120K tokens context, but be conservative)
    const maxLength = 100000; // Increased limit for better summaries
    const textToSummarize = extractedText.length > maxLength 
      ? extractedText.substring(0, maxLength) + "\n\n[Note: Content truncated due to length. Summary based on first part of document.]"
      : extractedText;

    console.log(`Calling OpenAI API with ${textToSummarize.length} characters...`);

    // Call OpenAI API for summarization with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Using gpt-4o for better reliability
          messages: [
            {
              role: 'system',
              content: 'You are an expert at summarizing documents. Create comprehensive, well-structured summaries with clear sections, key insights, and actionable recommendations. Format your response in markdown with proper headings and bullet points.'
            },
            {
              role: 'user',
              content: `Please provide a comprehensive summary of the following document${fileName ? ` titled "${fileName}"` : ''}. Include:\n1. Executive Summary\n2. Key Topics and Main Points\n3. Important Details\n4. Conclusions or Recommendations\n\nDocument content:\n\n${textToSummarize}`
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

    console.log('Summary generated successfully');

    return new Response(
        JSON.stringify({ 
          summary,
          extractedText: extractedText.substring(0, 50000) // Return extracted text for Q&A (truncated)
        }),
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
          JSON.stringify({ error: 'Request timed out. The document might be too large. Please try with a smaller PDF.' }),
          { 
            status: 504,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      throw error; // Re-throw to be caught by outer catch
    }

  } catch (error) {
    console.error('Error in summarize-pdf:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: `Failed to process PDF: ${errorMessage}. Please check the PDF format and try again.`
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});