
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
  // Fix: Initialize the GoogleGenAI client with the API key from process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    // Remove header data:image/jpeg;base64, if present
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    // Fix: Use ai.models.generateContent with the gemini-3-flash-preview model and correct multimodal parts structure
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

    // Fix: Extract generated text from the response object property (not a method)
    const text = response.text;
    
    if (!text) {
      throw new Error("A IA não retornou nenhum texto.");
    }
    
    // Clean up markdown code blocks if Gemini sends them
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(jsonString) as ReceiptData;
  } catch (error) {
    console.error("Erro ao analisar recibo:", error);
    throw new Error("Não foi possível ler o comprovante. Verifique a qualidade da foto.");
  }
};
