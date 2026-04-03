import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
  console.error(`[transcribe-video] Error: ${message}`);
  return jsonResponse({ success: false, message }, status);
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (OpenAI Whisper limit)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return errorResponse('No audio file provided', 400);
    }
    if (audioFile.size > MAX_FILE_SIZE) {
      return errorResponse(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`, 413);
    }

    console.log(`[transcribe-video] Processing: ${audioFile.name}, size: ${(audioFile.size / 1024 / 1024).toFixed(1)}MB`);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return errorResponse('OPENAI_API_KEY not configured', 503);
    }

    const openAiFormData = new FormData();
    openAiFormData.append('file', audioFile);
    openAiFormData.append('model', 'whisper-1');
    openAiFormData.append('response_format', 'verbose_json');
    openAiFormData.append('timestamp_granularities[]', 'segment');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: openAiFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[transcribe-video] OpenAI API error:', error);
      try {
        const parsed = JSON.parse(error);
        const code = parsed?.error?.code;
        if (code === 'insufficient_quota') {
          return errorResponse('OpenAI API quota exceeded. Please check your billing at platform.openai.com or update your API key.', 402);
        }
      } catch {}
      if (response.status === 429) return errorResponse('Rate limit exceeded. Please try again in a moment.', 429);
      return errorResponse(`Transcription API error: ${response.status}`);
    }

    const result = await response.json();
    const timestamps = result.segments?.map((segment: { start: number; text: string }) => ({
      time: formatTime(segment.start),
      text: segment.text.trim()
    })) || [];

    const elapsed = Date.now() - startTime;
    console.log(`[transcribe-video] Success in ${elapsed}ms, ${result.text.length} chars`);

    return jsonResponse({
      success: true,
      text: result.text,
      timestamps,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[transcribe-video] Failed after ${elapsed}ms:`, error);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error');
  }
});

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
