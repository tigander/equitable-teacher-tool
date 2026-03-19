export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  try {
    const { prompt, selectedPersonas } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            reflections: {
              type: 'OBJECT',
              properties: Object.fromEntries(
                (selectedPersonas || []).map((id) => [id, { type: 'STRING' }])
              ),
              required: selectedPersonas || []
            },
            recommendations: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  text: { type: 'STRING' },
                  sourceKey: { type: 'STRING' }
                },
                required: ['text', 'sourceKey']
              }
            }
          },
          required: ['reflections', 'recommendations']
        }
      }
    };

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini API request failed',
        details: data,
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: 'No model output returned' });
    }

    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Internal server error'
    });
  }
}
