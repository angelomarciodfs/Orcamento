
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
  // A inicialização deve usar estritamente process.env.API_KEY como parâmetro nomeado
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
              {
                "date": "YYYY-MM-DD",
                "amount": 0.00,
                "description": "Nome do Estabelecimento",
                "categoryHint": "Sugestão de Categoria"
              }
              Responda APENAS o JSON.
            `
          }
        ]
      },
    });

    // O texto deve ser acessado via propriedade .text, nunca como método .text()
    const text = response.text;
    
    if (!text) {
      throw new Error("A IA não retornou resposta.");
    }
    
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString) as ReceiptData;
  } catch (error) {
    console.error("Erro no Gemini Service:", error);
    throw new Error("Falha ao analisar o comprovante.");
  }
};
