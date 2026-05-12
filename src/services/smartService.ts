import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment variables.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export interface SmartTrialInfo {
  serviceName: string;
  durationDays: number;
  price?: number;
  currency?: string;
  category?: string;
  confidence: number;
}

export async function analyzeTrialImage(base64Image: string): Promise<SmartTrialInfo> {
  // Validate input
  if (!base64Image) {
    throw new Error("No image data provided for AI analysis.");
  }

  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image
            }
          },
          {
            text: `Analyze this image for subscription trial details. 
            Focus on extracting:
            - Service Name (e.g., Netflix, Adobe, etc.)
            - Trial length in DAYS (e.g., "1 month" = 30, "7 day" = 7).
            - Price after the trial period.
            - Currency code.
            - Most likely category.

            If details are missing, provide your best guess based on the service name or context.
            Return results strictly as a valid JSON object.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            serviceName: { type: Type.STRING },
            durationDays: { type: Type.INTEGER },
            price: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            category: { type: Type.STRING, enum: ["Entertainment", "Productivity", "Utilities", "Health", "Other"] },
            confidence: { type: Type.NUMBER }
          },
          required: ["serviceName", "durationDays"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("AI returned an empty response.");
    }

    return JSON.parse(text);
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    
    // Categorize errors
    if (error.message?.includes("API key")) {
      throw new Error("AI service configuration error. Please contact support.");
    }
    if (error.message?.includes("quota") || error.message?.includes("limit")) {
      throw new Error("AI service is busy. Please try manual entry or wait a minute.");
    }
    if (error instanceof SyntaxError) {
      throw new Error("AI returned invalid data format. Please enter details manually.");
    }
    
    throw new Error("AI failed to read this image. Text might be too blurry or complex.");
  }
}
