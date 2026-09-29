import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  throw new Error("Image file not found");
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY repository secret is not set");
}

const ext = path.extname(file).toLowerCase();
const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
const image = "data:" + mime + ";base64," + fs.readFileSync(file).toString("base64");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["rooms","doors","markers","warnings","overall_confidence"],
  properties: {
    overall_confidence: { type:"number", minimum:0, maximum:1 },
    warnings: { type:"array", items:{type:"string"} },
    rooms: {
      type:"array",
      items:{
        type:"object", additionalProperties:false,
        required:["name","polygon","shape","confidence"],
        properties:{
          name:{type:"string"},
          shape:{type:"string", enum:["rect","l","free"]},
          confidence:{type:"number",minimum:0,maximum:1},
          polygon:{
            type:"array", minItems:4, maxItems:24,
            items:{type:"array",minItems:2,maxItems:2,items:{type:"number"}}
          }
        }
      }
    },
    doors:{
      type:"array",
      items:{
        type:"object",additionalProperties:false,
        required:["type","x","y","angle","confidence"],
        properties:{
          type:{type:"string",enum:["single","double"]},
          x:{type:"number"},y:{type:"number"},angle:{type:"number"},
          confidence:{type:"number",minimum:0,maximum:1}
        }
      }
    },
    markers:{
      type:"array",
      items:{
        type:"object",additionalProperties:false,
        required:["type","x","y","confidence"],
        properties:{
          type:{type:"string",enum:["facp","mcp","here"]},
          x:{type:"number"},y:{type:"number"},
          confidence:{type:"number",minimum:0,maximum:1}
        }
      }
    }
  }
};

const instructions = `
You are extracting geometry from a photograph of a hand-drawn building floor plan.
Return editor coordinates on a 760 x 500 canvas.
Do not assign fire alarm zones or make compliance decisions.

Rules:
- Follow the visible outer and internal wall geometry closely.
- Preserve irregular corridor shapes; do not force everything into rectangles.
- Read handwritten and printed room labels carefully.
- Only identify a door where the image shows strong door evidence such as a leaf, swing arc or double-door symbol.
- A gap in a line is not by itself enough evidence for a door.
- If uncertain, omit the object and add a warning.
- Do not invent rooms, doors, openings, names, stairs or markers.
- Use confidence values based only on visible evidence.
- Polygon points must be ordered around each room.
`;

async function pass(previous){
  const text = previous
    ? "Second-pass verification: compare the photo with this first result, then correct any geometry, room names, missing/false doors, and confidence values. Prefer the photograph over the first result. FIRST RESULT: " + JSON.stringify(previous)
    : "First-pass extraction: identify rooms, boundaries, labels and strongly-supported doors.";

  const response = await client.responses.create({
    model: "gpt-5.6-terra",
    reasoning: { effort: "high" },
    instructions,
    input: [{
      role: "user",
      content: [
        { type:"input_text", text },
        { type:"input_image", image_url:image, detail:"original" }
      ]
    }],
    text:{
      format:{
        type:"json_schema",
        name:"floor_plan_scan",
        strict:true,
        schema
      }
    }
  });
  return JSON.parse(response.output_text);
}

const first = await pass(null);
const second = await pass(first);
second.warnings = [...new Set([...(first.warnings||[]), ...(second.warnings||[])])];
second.source_file = file;
second.processed_at = new Date().toISOString();
second.workflow_version = "github-actions-v1";

fs.mkdirSync("results/history",{recursive:true});
fs.writeFileSync("results/latest.json", JSON.stringify(second,null,2));
const stamp = new Date().toISOString().replace(/[:.]/g,"-");
fs.writeFileSync("results/history/" + stamp + ".json", JSON.stringify(second,null,2));
console.log("Wrote results/latest.json");
