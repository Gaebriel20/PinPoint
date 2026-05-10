// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { content } = await req.json();

    if (!content || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'No content provided' }), {
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

    // Minimum content check before calling API
    if (content.trim().split(/\s+/).length < 30) {
      return new Response(JSON.stringify({ error: 'insufficient_context' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const prompt = `You are a quiz generator. Assess the following text and generate a 10-question quiz.

Rules:
- Generate EXACTLY 5 "multiple_choice" questions and EXACTLY 5 "identification" questions (10 questions total).
- For "multiple_choice": include an "options" array of exactly 4 strings, and "answer" must exactly match one option
- For "identification": "options" should be null, and "answer" is a short string (1-5 words)
- Questions must be based strictly on the provided text
- If the text is too short or lacks enough factual information for 10 questions, return: {"error": "insufficient_context"}

Required JSON format:
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A"
    },
    {
      "type": "identification",
      "question": "Question text here?",
      "options": null,
      "answer": "Short answer"
    }
  ]
}

Text to generate quiz from:
"""
${content}
"""

Respond ONLY with valid JSON. No markdown, no explanation, no code blocks.`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a helpful quiz generator that always responds with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      }),
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.text();
      console.error('Groq API Error:', groqResponse.status, errorData);
      return new Response(JSON.stringify({ error: `Groq error ${groqResponse.status}: ${errorData}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const result = await groqResponse.json();
    const rawContent = result.choices?.[0]?.message?.content;

    if (!rawContent) {
      return new Response(JSON.stringify({ error: 'Empty response from AI' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const parsed = JSON.parse(rawContent);

    // Validate the parsed result
    if (parsed.error === 'insufficient_context') {
      return new Response(JSON.stringify({ error: 'insufficient_context' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return new Response(JSON.stringify({ error: 'insufficient_context' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Quiz generation error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
