
import { GoogleGenAI } from "@google/genai";

interface Env {
  API_KEY: string;
}

export const onRequest = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method Not Allowed" }), { status: 405 });
  }

  try {
    const { imageBase64 } = await request.json() as { imageBase64: string };
    if (!imageBase64) return new Response("Missing image", { status: 400 });

    const ai = new GoogleGenAI({ apiKey: env.API_KEY });
    
    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64.split(",")[1] || imageBase64,
      },
    };

    const prompt = `
      You are a world-class luxury interior designer and architectural visualizer. 
      Analyze this room photo and provide a brief, professional "Studio Vision" in Japanese (about 150 characters).
      Include:
      1. Spatial characteristics (e.g., lighting, ceiling height).
      2. Recommended staging style (e.g., Japandi, Modern Minimalist).
      3. One key advice to maximize market value.
      Keep the tone extremely professional, encouraging, and sophisticated.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [imagePart, { text: prompt }] }],
    });

    return new Response(JSON.stringify({ analysis: response.text }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error: any) {
    console.error("[Gemini Error]", error);
    return new Response(JSON.stringify({ message: "AI Analysis currently unavailable." }), { status: 500 });
  }
};
