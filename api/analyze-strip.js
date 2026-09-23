import { Groq } from 'groq-sdk';

export default async function handler(req, res) {
  // CORS & Method Check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GROQ_API_KEY is not configured on the server environment.'
    });
  }

  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 parameter is required.' });
    }

    const groq = new Groq({ apiKey });

    const formattedImageUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [
        {
          role: 'system',
          content: `You are a high-precision industrial safety vision classifier for an H2S passive dosimeter optical reader.
Your ONLY task is to identify and locate the rectangular physical H2S SENSOR PANEL inside the image.

The H2S SENSOR PANEL has a specific 3-region horizontal structure:
- LEFT: H2S detector pad
- MIDDLE: reference color calibration scale (swatch gradient)
- RIGHT: expiry indicator badge

IMPORTANT OBJECT BOUNDARY INSTRUCTIONS:
- Target object is ONLY the rectangular H2S SENSOR PANEL itself.
- Do NOT include the outer black fabric/rubber wrist strap or surrounding arm/background. Return a tight bounding box around ONLY the inner rectangular sensor panel.

REJECT the image (stripDetected = false) if:
- The image contains NO physical H2S sensor panel
- The image contains a person, classroom, wall, furniture, table, floor, clothing, skin, hand, phone, screen, screenshot, or unrelated object
- The image contains an arbitrary single purple, yellow, orange, blue, or white object that is not an H2S sensor panel
- Only a partial or severely occluded sensor panel is visible where the 3-region structure cannot be reliably identified

Return JSON strictly matching this format:
{
  "stripDetected": boolean,
  "confidence": number (between 0.0 and 1.0),
  "x": number (normalized 0.0 to 1.0 left edge of bounding box),
  "y": number (normalized 0.0 to 1.0 top edge of bounding box),
  "width": number (normalized 0.0 to 1.0 bounding box width),
  "height": number (normalized 0.0 to 1.0 bounding box height),
  "orientation": "horizontal" | "vertical" | "unknown",
  "reason": string
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Detect the physical H2S sensor panel and return its tight normalized bounding box [x, y, width, height], or set stripDetected to false if not present.'
            },
            {
              type: 'image_url',
              image_url: {
                url: formattedImageUrl
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 300
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return res.status(500).json({ error: 'Empty response returned from Groq Vision API.' });
    }

    const cleanJsonStr = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJsonStr);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[GROQ API ENDPOINT ERROR]:', err);
    return res.status(500).json({
      error: 'Visual detection unavailable. Please try again.',
      details: err.message
    });
  }
}
