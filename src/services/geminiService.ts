
// @ts-ignore
import { GoogleGenAI } from "@google/genai";

export interface ReceiptData {
  date?: string;
  amount?: number;
  description?: string;
  categoryHint?: string;
}

export const analyzeReceiptWithGemini = async (
  imageBase64: string
): Promise<ReceiptData> => {
  // Verificação segura para evitar erro de 'process is not defined'
  let apiKey = "";
  try {
    // @ts-ignore
    apiKey = typeof process !== 'undefined' ? process.env.API_KEY : '';
  } catch (e) {
    console.warn("Ambiente sem process.env definido");
  }

  if (!apiKey) {
    throw new Error("API Key do Gemini não configurada.");
  }

  // @ts-ignore
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: "image/jpeg",
            },
          },
          {
            text: `
              Analise esta imagem de um comprovante fiscal brasileiro.
              Retorne APENAS um JSON:
              {
                "date": "YYYY-MM-DD",
                "amount": 0.00,
                "description": "Nome do Local",
                "categoryHint": "Categoria Sugerida"
              }
            `
          }
        ]
      },
    });

    const text = response.text || "";
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString) as ReceiptData;
  } catch (error) {
    console.error("Erro Gemini:", error);
    throw new Error("Falha na análise da IA.");
  }
};
