import { Message } from "../types";

// Tipos de emoção expandidos
export type EmotionType = 'Neutro' | 'Alegre' | 'Reflexivo' | 'Tenso' | 'Empático' | 'Apaixonado' | 'Entusiasmado' | 'Cético' | 'Visual';

interface AnalysisResult {
    myEmotion: { tone: EmotionType; intensity: number };
    partnerEmotion: { tone: EmotionType; intensity: number };
}

export const analyzeConversationEmotion = async (messages: Message[], currentUserId: string): Promise<AnalysisResult> => {
  // Simula latência de processamento
  await new Promise(resolve => setTimeout(resolve, 300));

  if (messages.length === 0) {
      return {
          myEmotion: { tone: 'Neutro', intensity: 0 },
          partnerEmotion: { tone: 'Neutro', intensity: 0 }
      };
  }

  // Separa as mensagens e pega apenas as últimas 15 para contexto imediato
  const myMessages = messages.filter(m => m.sender_id === currentUserId).slice(-15); 
  const partnerMessages = messages.filter(m => m.sender_id !== currentUserId).slice(-15);

  const analyzeSubset = (msgs: Message[]): { tone: EmotionType; intensity: number } => {
      if (msgs.length === 0) return { tone: 'Neutro', intensity: 0 };
      
      // Filtra apenas mensagens de texto para análise léxica
      const textMsgs = msgs.filter(m => m.type !== 'image' && m.type !== 'location');
      const imageMsgs = msgs.filter(m => m.type === 'image');

      // Se o usuário só mandou imagens recentemente e pouco texto
      if (imageMsgs.length > 0 && textMsgs.length === 0) {
          return { tone: 'Visual', intensity: 10 + (imageMsgs.length * 5) };
      }

      const text = textMsgs.map(m => m.content.toLowerCase()).join(' ');
      
      // Dicionário de Sentimentos (Heurística Aprimorada)
      const keywords = {
          alegre: ['kkk', 'haha', 'lol', 'rs', 'legal', 'top', 'bom', 'ótimo', 'maravilha', 'show', 'feliz', 'sorrir', 'animado', 'boas'],
          reflexivo: ['hmm', 'será', 'acho', 'talvez', 'pensando', 'vida', 'tempo', 'difícil', 'triste', 'pena', 'sinto', 'calma', '...'],
          tenso: ['não', 'nada', 'droga', 'merda', 'aff', 'pq', 'por que', 'saco', 'odeio', 'chato', 'ruim', 'pare', 'basta', '???'],
          empatico: ['entendo', 'verdade', 'pode crer', 'imagino', 'sinto muito', 'conte comigo', 'nós', 'juntos', 'tranquilo', 'obrigado', 'vlw'],
          apaixonado: ['amor', 'linda', 'lindo', 'amo', 'adoro', 'saudade', 'beijo', 'coração', 'paixão', 'gostoso', 'gostosa', '<3'],
          entusiasmado: ['vamos', 'bora', 'agora', 'incrível', 'demais', 'uau', 'caraca', 'meu deus', 'eita', 'correr', '!!!', '🔥🔥'],
          cetico: ['sei lá', 'duvido', 'estranho', 'serio?', 'mentira', 'hum', 'ué']
      };

      const scores: Record<string, number> = {};
      
      Object.entries(keywords).forEach(([key, words]) => {
          let count = 0;
          words.forEach(w => {
               const regex = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'); // Escape special chars
               const matches = text.match(regex);
               if (matches) count += matches.length;
               
               // Detecção de pontuação excessiva
               if (key === 'entusiasmado' && text.includes('!')) count += 0.5;
               if (key === 'tenso' && text.includes('CAPS LOCK')) count += 1; // Pseudo-check
          });
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

      const map: Record<string, EmotionType> = {
          alegre: 'Alegre',
          reflexivo: 'Reflexivo',
          tenso: 'Tenso',
          empatico: 'Empático',
          apaixonado: 'Apaixonado',
          entusiasmado: 'Entusiasmado',
          cetico: 'Cético',
          neutro: 'Neutro'
      };

      const tone = map[winnerKey] || 'Neutro';
      
      // Intensidade baseada no score e na velocidade (quantidade de mensagens no slice)
      const quantityBonus = msgs.length * 2;
      const intensity = Math.min(100, Math.max(10, (maxScore * 20) + quantityBonus));

      return { tone, intensity };
  };

  return {
      myEmotion: analyzeSubset(myMessages),
      partnerEmotion: analyzeSubset(partnerMessages)
  };
};