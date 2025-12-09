import { GoogleGenAI, Type } from "@google/genai";
import { Material } from "../types";

// Helper to safely get the AI client
// We initialize this inside functions to prevent the app from crashing on load 
// if the process.env is undefined in certain deployment environments.
const getGenAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is missing. Generative features will fail.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateMaterial = async (topic: string): Promise<Material | null> => {
  try {
    const ai = getGenAI();
    if (!ai) return null;

    const model = "gemini-2.5-flash";
    const prompt = `Generate a short educational article about "${topic}".
    The output must be a valid JSON object matching the following schema.
    Divide the text into 5 to 8 short segments suitable for listening practice.
    Assign hypothetical timestamps assuming a slow reading speed (approx 4-6 seconds per sentence).
    
    Schema:
    {
      "title": "string",
      "description": "string",
      "category": "string",
      "difficulty": "Easy" | "Medium" | "Hard",
      "segments": [
        {
          "text": "string",
          "startTime": number,
          "endTime": number
        }
      ]
    }`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER }
                },
                required: ["text", "startTime", "endTime"]
              }
            }
          },
          required: ["title", "description", "segments"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    
    // Transform into our internal Material type
    return {
      id: Date.now().toString(),
      title: data.title,
      description: data.description,
      category: data.category || "General",
      difficulty: data.difficulty || "Medium",
      duration: "1:00", // Mock duration
      // Use Pollinations AI to generate a relevant image based on the topic
      imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " cinematic lighting abstract wallpaper")}?width=800&height=600&nologo=true`,
      audioUrl: "", // No real audio for generated content in this demo
      segments: data.segments.map((s: any, idx: number) => ({
        id: `gen-${idx}`,
        text: s.text,
        startTime: s.startTime,
        endTime: s.endTime
      }))
    };

  } catch (error) {
    console.error("Gemini generation error:", error);
    return null;
  }
};

export const getWordDefinition = async (word: string, context: string): Promise<string> => {
  try {
    const ai = getGenAI();
    if (!ai) return "API Key missing";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Define the word "${word}" briefly (under 30 words) as it is used in this context: "${context}". Return just the definition.`,
    });
    return response.text || "Definition not found.";
  } catch (error) {
    console.error("Definition error", error);
    return "Could not load definition.";
  }
};