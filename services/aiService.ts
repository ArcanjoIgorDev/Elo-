
import { Message } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// Recupera a API Key de forma robusta
const getApiKey = () => {
    // 1. Tenta var de ambiente padrão (Build tools)
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
    // 2. Tenta window.process (Polyfill)
    // @ts-ignore
    if (typeof window !== 'undefined' && window.process?.env?.API_KEY) return window.process.env.API_KEY;
    // 3. Fallback para debug em produção (permite setar localStorage.setItem('DEBUG_API_KEY', 'sua-key') no console)
    if (typeof window !== 'undefined') {
        const debugKey = localStorage.getItem('DEBUG_API_KEY');
        if (debugKey) return debugKey;
    }
    return '';
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

// Cache simples para localização AI (chave: query, valor: resposta)
const LOCATION_CACHE = new Map<string, string[]>();

export type EmotionType = 
    'Neutro' | 'Alegre' | 'Reflexivo' | 'Tenso' | 'Empático' | 
    'Apaixonado' | 'Entusiasmado' | 'Cético' | 'Visual' | 
    'Ansioso' | 'Grato' | 'Curioso' | 'Irônico';

interface AnalysisResult {
    myEmotion: { tone: EmotionType; intensity: number };
    partnerEmotion: { tone: EmotionType; intensity: number };
}

// --- HELPER: Extração Segura de JSON ---
const extractJSON = (text: string): any => {
    try {
        // Tenta parse direto primeiro
        return JSON.parse(text);
    } catch (e) {
        // Se falhar, tenta extrair o primeiro bloco JSON válido (Array [...] ou Objeto {...})
        const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (e2) {
                console.error("ELO_AI: Falha ao extrair JSON via regex", e2);
                return null;
            }
        }
        return null;
    }
};

// --- NOVAS FUNÇÕES DE LOCALIZAÇÃO VIA IA ---

export const suggestLocations = async (query: string): Promise<string[]> => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery || cleanQuery.length < 3) return [];
    
    // Verifica Cache antes de chamar API
    if (LOCATION_CACHE.has(cleanQuery)) {
        return LOCATION_CACHE.get(cleanQuery) || [];
    }

    if (!apiKey) {
        console.warn("ELO_AI: API_KEY não encontrada. Use localStorage.setItem('DEBUG_API_KEY', 'key') para testar.");
        return []; 
    }

    try {
        // Usando 1.5-flash por ser extremamente estável para tarefas de formatação JSON
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash", 
            contents: `Atue como um sistema de autocomplete de GPS. O usuário digitou: "${query}". 
            Retorne um ARRAY JSON estrito com 5 sugestões de locais reais no Brasil.
            Formato: ["Cidade - Estado", "Bairro, Cidade - Estado"].
            Exemplo: ["São Paulo - SP", "Santo Amaro, São Paulo - SP"].
            Retorne APENAS o JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });

        if (response.text) {
            const results = extractJSON(response.text);
            if (Array.isArray(results)) {
                LOCATION_CACHE.set(cleanQuery, results);
                return results;
            }
        }
        return [];
    } catch (error) {
        console.error("ELO_AI: Erro ao sugerir locais:", error);
        return [];
    }
};

export const geocodeLocation = async (locationString: string): Promise<{ latitude: number, longitude: number } | null> => {
    if (!apiKey) return null;

    // Cache simples também para geocoding (chave: string completa)
    const cacheKey = `GEO:${locationString}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: `Coordenadas geográficas exatas (latitude, longitude) do centro de: "${locationString}". JSON apenas.`,
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
             const res = extractJSON(response.text);
             if (res && typeof res.latitude === 'number' && typeof res.longitude === 'number') {
                 // Salva no Cache (Persistente para geo)
                 localStorage.setItem(cacheKey, JSON.stringify(res));
                 return res;
             }
        }
        return null;
    } catch (error) {
        console.error("ELO_AI: Erro ao geocodificar:", error);
        return null;
    }
};

// --- ANÁLISE DE EMOÇÃO ---

export const analyzeConversationEmotion = async (messages: Message[], currentUserId: string): Promise<AnalysisResult> => {
  await new Promise(resolve => setTimeout(resolve, 50)); 

  if (messages.length === 0) {
      return {
          myEmotion: { tone: 'Neutro', intensity: 0 },
          partnerEmotion: { tone: 'Neutro', intensity: 0 }
      };
  }

  const myMessages = messages.filter(m => m.sender_id === currentUserId).slice(-20); 
  const partnerMessages = messages.filter(m => m.sender_id !== currentUserId).slice(-20);

  const analyzeSubset = (msgs: Message[]): { tone: EmotionType; intensity: number } => {
      if (msgs.length === 0) return { tone: 'Neutro', intensity: 0 };
      
      const textMsgs = msgs.filter(m => m.type !== 'image' && m.type !== 'location');
      const imageMsgs = msgs.filter(m => m.type === 'image');

      if (imageMsgs.length > 0 && textMsgs.length === 0) {
          return { tone: 'Visual', intensity: Math.min(100, 20 + (imageMsgs.length * 10)) };
      }

      const text = textMsgs.map(m => m.content.toLowerCase()).join(' ');
      
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
          ironico: ['claro que sim', 'super', 'aham ta', 'nossa', 'parabens', 'ajudou muito', '😒']
      };

      const scores: Record<string, number> = {};
      
      Object.entries(dictionary).forEach(([key, words]) => {
          let count = 0;
          words.forEach(w => {
               const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
               const regex = new RegExp(w.match(/\p{Emoji}/u) ? escaped : `\\b${escaped}\\b`, 'giu');
               if (text.match(regex)) count += (text.match(regex) || []).length;
          });
          scores[key] = count;
      });

      let maxScore = 0;
      let winnerKey = 'neutro';

      Object.entries(scores).forEach(([key, score]) => {
          if (score > maxScore) { maxScore = score; winnerKey = key; }
      });

      const map: Record<string, EmotionType> = {
          alegre: 'Alegre', reflexivo: 'Reflexivo', tenso: 'Tenso', empatico: 'Empático', apaixonado: 'Apaixonado',
          entusiasmado: 'Entusiasmado', cetico: 'Cético', ansioso: 'Ansioso', grato: 'Grato', curioso: 'Curioso',
          ironico: 'Irônico', neutro: 'Neutro'
      };

      const tone = map[winnerKey] || 'Neutro';
      let intensity = Math.min(100, (maxScore / Math.max(1, msgs.length * 0.5)) * 100);
      if (maxScore > 3) intensity = Math.max(intensity, 60);
      if (winnerKey === 'neutro') intensity = 0;

      return { tone, intensity };
  };

  return { myEmotion: analyzeSubset(myMessages), partnerEmotion: analyzeSubset(partnerMessages) };
};
