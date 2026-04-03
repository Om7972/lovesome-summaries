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

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return errorResponse('LOVABLE_API_KEY not configured', 503);
    }

    // Convert audio file to base64 for Gemini multimodal input
    const arrayBuffer = await audioFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Audio = btoa(binary);

    // Determine MIME type
    const extension = audioFile.name.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska', 'webm': 'video/webm', 'mp3': 'audio/mpeg',
      'wav': 'audio/wav', 'ogg': 'audio/ogg', 'm4a': 'audio/mp4',
    };
    const mimeType = mimeMap[extension] || audioFile.type || 'video/mp4';

    console.log(`[transcribe-video] Using Lovable AI (Gemini) for transcription, mime: ${mimeType}`);

    // Use Lovable AI Gateway with Gemini for audio transcription
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a precise audio/video transcription assistant. Your task is to transcribe the spoken content from the provided media file.

Output ONLY a valid JSON object with this exact structure:
{
  "text": "full transcription text here",
  "segments": [
    {"start": 0.0, "text": "first segment text"},
    {"start": 15.5, "text": "next segment text"}
  ]
}

Rules:
- Transcribe ALL spoken words accurately
- Break the transcription into segments of roughly 10-30 seconds each
- The "start" field is the approximate start time in seconds
- The "text" field in the root is the complete transcription joined together
- Do NOT include any markdown, code blocks, or extra text - ONLY the JSON object
- If the audio is in a non-English language, transcribe it in the original language`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Audio}`
                }
              },
              {
                type: 'text',
                text: 'Please transcribe all spoken content from this media file. Return ONLY the JSON object with the transcription.'
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[transcribe-video] Lovable AI error:', response.status, errorText);
      if (response.status === 429) return errorResponse('Rate limit exceeded. Please try again in a moment.', 429);
      if (response.status === 402) return errorResponse('AI credits exhausted. Please add funds in Settings → Cloud & AI balance.', 402);
      return errorResponse(`Transcription service error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Parse the JSON response from Gemini
    let transcriptionText = '';
    let timestamps: Array<{ time: string; text: string }> = [];

    try {
      // Clean potential markdown code blocks
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);
      transcriptionText = parsed.text || '';
      timestamps = (parsed.segments || []).map((seg: { start: number; text: string }) => ({
        time: formatTime(seg.start),
        text: seg.text.trim(),
      }));
    } catch {
      // If JSON parsing fails, use the raw text as transcription
      console.warn('[transcribe-video] Could not parse structured response, using raw text');
      transcriptionText = content.trim();
    }

    if (!transcriptionText) {
      return errorResponse('Could not extract transcription from the media file.', 422);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[transcribe-video] Success in ${elapsed}ms, ${transcriptionText.length} chars`);

    return jsonResponse({
      success: true,
      text: transcriptionText,
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
