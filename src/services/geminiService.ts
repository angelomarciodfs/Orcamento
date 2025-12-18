
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
  // @ts-ignore
  const apiKey = process.env.API_KEY || "";
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
              Analise esta imagem de um comprovante fiscal ou recibo brasileiro.
              Extraia as seguintes informações em formato JSON estrito, sem markdown:
              1. "date": A data da compra no formato YYYY-MM-DD.
              2. "amount": O valor total da compra (número float).
              3. "description": O nome do estabelecimento ou uma descrição resumida (ex: "Mercado Extra", "Uber").
              4. "categoryHint": Uma sugestão de categoria baseada no estabelecimento (ex: "Alimentação", "Transporte", "Saúde", "Farmácia").
              
              Se não encontrar algum dado, retorne null no campo.
              Responda APENAS o JSON.
            `
          }
        ]
      },
    });

    const text = response.text;
    
    if (!text) {
      throw new Error("A IA não retornou nenhum texto.");
    }
    
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(jsonString) as ReceiptData;
  } catch (error) {
    console.error("Erro ao analisar recibo:", error);
    throw new Error("Não foi possível ler o comprovante. Verifique a qualidade da foto.");
  }
};
