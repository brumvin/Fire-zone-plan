# Fire Zone Plan AI backend

GitHub Pages is static, so the browser must not contain an OpenAI API key.

## Endpoint
POST /api/analyse-plan

Request:
```json
{"image":"data:image/jpeg;base64,..."}
```

Response:
```json
{
  "rooms":[
    {"name":"Office 1","polygon":[[35,45],[185,45],[185,185],[35,185]],"shape":"rect","confidence":0.97}
  ],
  "doors":[
    {"type":"single","x":150,"y":185,"angle":0,"confidence":0.82}
  ],
  "markers":[]
}
```

## Recognition approach
Use a vision-capable model through the OpenAI Responses API. The model should:
1. Inspect the full photo.
2. Identify the outer building boundary and internal wall centre-lines.
3. Read handwritten/printed room labels.
4. Identify openings separately from confirmed doors.
5. Return normalized editor coordinates, not prose.
6. Give a confidence value for every room, wall, label and door.
7. Never assign fire alarm zones automatically.
8. Mark uncertain geometry for engineer review.

## Security
Keep OPENAI_API_KEY only as a server/serverless secret. Never place it in index.html or browser JavaScript.

## Deployment
Suitable hosts include a company server, Azure Function, AWS Lambda, Cloudflare Worker or Vercel/Netlify serverless function. Set CORS to the approved application origin.
