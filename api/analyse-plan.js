import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const point = {
  type: "array",
  minItems: 2,
  maxItems: 2,
  items: { type: "number", minimum: 0, maximum: 760 }
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["rooms","doors","markers","warnings","overall_confidence"],
  properties: {
    overall_confidence: { type: "number", minimum: 0, maximum: 1 },
    warnings: { type: "array", items: { type: "string" } },
    rooms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name","polygon","shape","confidence"],
        properties: {
          name: { type: "string" },
          shape: { type: "string", enum: ["rect","l","free"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          polygon: {
            type: "array",
            minItems: 4,
            maxItems: 24,
            items: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: { type: "number", minimum: 0, maximum: 760 }
            }
          }
        }
      }
    },
    doors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type","x","y","angle","confidence"],
        properties: {
          type: { type: "string", enum: ["single","double"] },
          x: { type: "number", minimum: 0, maximum: 760 },
          y: { type: "number", minimum: 0, maximum: 500 },
          angle: { type: "number", minimum: -180, maximum: 180 },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    },
    markers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type","x","y","confidence"],
        properties: {
          type: { type: "string", enum: ["facp","mcp","here"] },
          x: { type: "number", minimum: 0, maximum: 760 },
          y: { type: "number", minimum: 0, maximum: 500 },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    }
  }
};

const systemPrompt = `
You analyse photographs of hand-drawn building floor plans for a fire-alarm zone-plan editor.
This is geometry extraction, not fire-safety design.
Never assign fire alarm zones and never infer compliance.

Coordinate system:
- The supplied image has been normalized to a 760 x 500 editor canvas.
- Return x coordinates from 0..760 and y coordinates from 0..500.
- Trace the actual visible room boundaries as closely as possible.
- Do not force corridors or irregular rooms into rectangles.
- Read handwritten room names carefully.
- A gap is not automatically a door.
- Only return a door when a door leaf, swing arc, double-door symbol, or other strong door evidence is visible.
- If uncertain, omit the door and add a warning.
- Do not invent rooms, openings, labels or markers.
- Confidence is per item, based only on visible evidence.
`;

async function analyse(image, previous = null) {
  const prompt = previous
    ? `Second-pass verification. Compare the image against this first-pass extraction and correct geometry, labels and door locations. Prefer the visible drawing over the first-pass result. First pass: ${JSON.stringify(previous)}`
    : "Extract the floor-plan structure from this image.";

  const response = await client.responses.create({
    model: "gpt-6-astra",
    reasoning: { effort: "high" },
    input: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: image, detail: "original" }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "fire_zone_floor_plan",
        strict: true,
        schema
      }
    }
  });
  return JSON.parse(response.output_text);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });

  try {
    const image = req.body?.image;
    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return res.status(400).json({ error: "A base64 image data URL is required" });
    }
    if (image.length > 18_000_000) {
      return res.status(413).json({ error: "Image too large" });
    }

    const first = await analyse(image);
    const second = await analyse(image, first);

    // Preserve explicit uncertainty from both passes.
    second.warnings = [...new Set([...(first.warnings || []), ...(second.warnings || [])])];
    return res.status(200).json(second);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "AI analysis failed", detail: error?.message || "Unknown error" });
  }
}
