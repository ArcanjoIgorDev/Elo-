import { GoogleGenAI, Type } from "@google/genai";
import { Message } from "../types";

// Inicialização preguiçosa para evitar crash no import se process não estiver definido
let aiInstance: GoogleGenAI | null = null;

const getAi = () => {
    if (aiInstance) return aiInstance;
    
    // Safety check: garante que não quebre se process.env não existir
    const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) 
        ? process.env.API_KEY 
        : '';
        
    aiInstance = new GoogleGenAI({ apiKey });
    return aiInstance;
};

export const analyzeConversationEmotion = async (messages: Message[]) => {
  if (messages.length === 0) return { tone: 'Neutro', intensity: 0 };

  const recentMessages = messages.slice(-15);
  
  const conversationText = recentMessages.map(m => 
    `${m.sender_id === 'me' ? 'Eu' : 'Outro'}: ${m.content}`
  ).join('\n');

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-latest",
      contents: `Analise a emoção e o tom desta conversa recente. Seja direto.
      
      Conversa:
      ${conversationText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tone: { type: Type.STRING, description: "Uma palavra descrevendo a emoção (ex: Empático, Tenso, Alegre)" },
            intensity: { type: Type.INTEGER, description: "Nível de intensidade de 0 a 100" }
          },
          required: ["tone", "intensity"]
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    return {
      tone: json.tone || 'Neutro',
      intensity: json.intensity || 50
    };

  } catch (error) {
    console.error("Erro na análise de IA:", error);
    return { tone: 'Offline', intensity: 0 };
  }
};