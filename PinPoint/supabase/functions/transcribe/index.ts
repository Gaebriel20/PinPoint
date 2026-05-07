import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const groqApiKey = Deno.env.get('Groq_API');
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: 'Groq API key is missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const groqFormData = new FormData();
    groqFormData.append('file', file);
    groqFormData.append('model', 'whisper-large-v3');
    groqFormData.append('response_format', 'json');

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: groqFormData,
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.text();
      console.error('Groq API Error:', errorData);
      return new Response(JSON.stringify({ error: `Failed to transcribe audio: ${errorData}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: groqResponse.status,
      });
    }

    const result = await groqResponse.json();
    return new Response(JSON.stringify({ text: result.text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Transcription error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
