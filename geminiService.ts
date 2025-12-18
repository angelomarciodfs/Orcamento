
// @ts-ignore
import { GoogleGenAI } from "@google/genai";

declare var process: { env: { API_KEY: string } };

export interface ReceiptData {
  date?: string;
  amount?: number;
  description?: string;
  categoryHint?: string;
}

export const analyzeReceiptWithGemini = async (
  imageBase64: string
): Promise<ReceiptData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } },
          { text: 'Extraia as informações do recibo em JSON: date (YYYY-MM-DD), amount (number), description (string).' }
        ]
      },
    });

    const text = response.text;
    if (!text) throw new Error("Sem resposta");
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString) as ReceiptData;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
