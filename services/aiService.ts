
import { Message } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// Inicializa o cliente GenAI (assumindo que process.env.API_KEY está disponível)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Tipos de emoção expandidos para maior granularidade
export type EmotionType = 
    'Neutro' | 'Alegre' | 'Reflexivo' | 'Tenso' | 'Empático' | 
    'Apaixonado' | 'Entusiasmado' | 'Cético' | 'Visual' | 
    'Ansioso' | 'Grato' | 'Curioso' | 'Irônico';

interface AnalysisResult {
    myEmotion: { tone: EmotionType; intensity: number };
    partnerEmotion: { tone: EmotionType; intensity: number };
}

// --- NOVAS FUNÇÕES DE LOCALIZAÇÃO VIA IA ---

export const suggestLocations = async (query: string): Promise<string[]> => {
    if (!query || query.length < 3) return [];

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Atue como um sistema de GPS brasileiro. O usuário digitou: "${query}". 
            Retorne uma lista JSON com 5 sugestões de locais reais no Brasil completando o que foi digitado.
            Formato obrigatório: "Cidade - Estado" ou "Bairro, Cidade - Estado".
            Exemplo: Se digitar "Pinhe", retorne ["Pinheiros, São Paulo - SP", "Pinheiral - RJ", ...].
            Priorize cidades grandes e bairros famosos.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text);
        }
        return [];
    } catch (error) {
        console.error("Erro ao sugerir locais:", error);
        return [];
    }
};

export const geocodeLocation = async (locationString: string): Promise<{ latitude: number, longitude: number } | null> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Retorne as coordenadas geográficas (latitude e longitude) exatas do centro de: "${locationString}".
            Retorne apenas o JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        latitude: { type: Type.NUMBER },
                        longitude: { type: Type.NUMBER }
                    },
                    required: ["latitude", "longitude"]
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text);
        }
        return null;
    } catch (error) {
        console.error("Erro ao geocodificar:", error);
        return null;
    }
};

// --- ANÁLISE DE EMOÇÃO EXISTENTE ---

export const analyzeConversationEmotion = async (messages: Message[], currentUserId: string): Promise<AnalysisResult> => {
  // Simulação rápida de processamento (local)
  await new Promise(resolve => setTimeout(resolve, 150));

  if (messages.length === 0) {
      return {
          myEmotion: { tone: 'Neutro', intensity: 0 },
          partnerEmotion: { tone: 'Neutro', intensity: 0 }
      };
  }

  // Analisa as últimas 20 mensagens para melhor contexto
  const myMessages = messages.filter(m => m.sender_id === currentUserId).slice(-20); 
  const partnerMessages = messages.filter(m => m.sender_id !== currentUserId).slice(-20);

  const analyzeSubset = (msgs: Message[]): { tone: EmotionType; intensity: number } => {
      if (msgs.length === 0) return { tone: 'Neutro', intensity: 0 };
      
      const textMsgs = msgs.filter(m => m.type !== 'image' && m.type !== 'location');
      const imageMsgs = msgs.filter(m => m.type === 'image');

      // Se há predominância visual
      if (imageMsgs.length > 0 && textMsgs.length === 0) {
          return { tone: 'Visual', intensity: Math.min(100, 20 + (imageMsgs.length * 10)) };
      }

      const text = textMsgs.map(m => m.content.toLowerCase()).join(' ');
      
      // Dicionário Expandido 2.0
      const dictionary: Record<string, string[]> = {
          alegre: ['kkk', 'haha', 'lol', 'rs', 'legal', 'top', 'bom', 'ótimo', 'maravilha', 'show', 'feliz', 'sorrir', 'animado', 'boas', 'hehe', '😂', '😁', 'gostei'],
          reflexivo: ['hmm', 'será', 'acho', 'talvez', 'pensando', 'vida', 'tempo', 'difícil', 'triste', 'pena', 'sinto', 'calma', '...', 'profundo', 'sentido', '🤔'],
          tenso: ['não', 'nada', 'droga', 'merda', 'aff', 'pq', 'por que', 'saco', 'odeio', 'chato', 'ruim', 'pare', 'basta', '???', '😡', '🤬', 'idiota', 'cansado'],
          empatico: ['entendo', 'verdade', 'pode crer', 'imagino', 'sinto muito', 'conte comigo', 'nós', 'juntos', 'tranquilo', 'obrigado', 'vlw', 'tmj', '🤝', '💜'],
          apaixonado: ['amor', 'linda', 'lindo', 'amo', 'adoro', 'saudade', 'beijo', 'coração', 'paixão', 'gostoso', 'gostosa', '<3', '😍', '🥰', 'casar'],
          entusiasmado: ['vamos', 'bora', 'agora', 'incrível', 'demais', 'uau', 'caraca', 'meu deus', 'eita', 'correr', '!!!', '🔥🔥', '🚀', 'best', 'topo'],
          cetico: ['sei lá', 'duvido', 'estranho', 'serio?', 'mentira', 'hum', 'ué', 'ata', 'aham', '🤨', '🙄'],
          ansioso: ['medo', 'preocupado', 'e agora', 'rápido', 'nervoso', 'tenso', 'socorro', '😰', '😬'],
          grato: ['obrigado', 'valeu', 'agradeço', 'gratidão', 'deus abençoe', 'salvou', '🙏', '✨'],
          curioso: ['como', 'onde', 'quando', 'quem', 'explica', 'sério', 'olha', 'interessante', '👀', 'conta mais'],
          ironico: ['claro que sim', 'super', 'aham ta', 'nossa', 'parabens', 'ajudou muito', '😒'] // Difícil detectar sem NLP real, heurística básica
      };

      const scores: Record<string, number> = {};
      
      Object.entries(dictionary).forEach(([key, words]) => {
          let count = 0;
          words.forEach(w => {
               // Regex para match exato da palavra ou emoji
               const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
               const regex = new RegExp(w.match(/\p{Emoji}/u) ? escaped : `\\b${escaped}\\b`, 'giu');
               
               const matches = text.match(regex);
               if (matches) {
                   count += matches.length;
                   // Bônus de pontuação para palavras no final da frase
                   if (new RegExp(`${escaped}[!.?]`, 'i').test(text)) count += 0.5;
               }
          });
          
          // Heurística de CAPS LOCK para Tensão/Entusiasmo
          if ((key === 'tenso' || key === 'entusiasmado') && textMsgs.some(m => m.content === m.content.toUpperCase() && m.content.length > 5)) {
              count += 2;
          }

          // Heurística de Exclamação
          if ((key === 'entusiasmado' || key === 'alegre') && text.includes('!!')) {
              count += 1;
          }

          scores[key] = count;
      });

      let maxScore = 0;
      let winnerKey = 'neutro';

      Object.entries(scores).forEach(([key, score]) => {
          if (score > maxScore) {
              maxScore = score;
              winnerKey = key;
          }
      });

      // Mapeamento para Tipos Fortes
      const map: Record<string, EmotionType> = {
          alegre: 'Alegre',
          reflexivo: 'Reflexivo',
          tenso: 'Tenso',
          empatico: 'Empático',
          apaixonado: 'Apaixonado',
          entusiasmado: 'Entusiasmado',
          cetico: 'Cético',
          ansioso: 'Ansioso',
          grato: 'Grato',
          curioso: 'Curioso',
          ironico: 'Irônico',
          neutro: 'Neutro'
      };

      const tone = map[winnerKey] || 'Neutro';
      
      // Intensidade baseada no score relativo ao tamanho das mensagens
      const msgCount = msgs.length;
      let intensity = Math.min(100, (maxScore / Math.max(1, msgCount * 0.5)) * 100);
      
      // Normalização: Se tem poucas mensagens mas muito score, é intenso
      if (maxScore > 3) intensity = Math.max(intensity, 60);
      if (winnerKey === 'neutro') intensity = 0;

      return { tone, intensity };
  };

  return {
      myEmotion: analyzeSubset(myMessages),
      partnerEmotion: analyzeSubset(partnerMessages)
  };
};
