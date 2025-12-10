
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ReceiptData {
  date?: string;
  amount?: number;
  description?: string;
  categoryHint?: string;
}

export const analyzeReceiptWithGemini = async (
  imageBase64: string,
  apiKey: string
): Promise<ReceiptData> => {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Analise esta imagem de um comprovante fiscal ou recibo brasileiro.
      Extraia as seguintes informações em formato JSON estrito, sem markdown:
      1. "date": A data da compra no formato YYYY-MM-DD.
      2. "amount": O valor total da compra (número float).
      3. "description": O nome do estabelecimento ou uma descrição resumida (ex: "Mercado Extra", "Uber").
      4. "categoryHint": Uma sugestão de categoria baseada no estabelecimento (ex: "Alimentação", "Transporte", "Saúde", "Farmácia").

      Se não encontrar algum dado, retorne null no campo.
      Responda APENAS o JSON.
    `;

    // Remove header data:image/jpeg;base64, if present
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: cleanBase64,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    // Clean up markdown code blocks if Gemini sends them
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(jsonString) as ReceiptData;
  } catch (error) {
    console.error("Erro ao analisar recibo:", error);
    throw new Error("Não foi possível ler o comprovante. Verifique sua chave API ou a qualidade da foto.");
  }
};
