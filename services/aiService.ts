import { Message } from "../types";

// Tipos de emoção expandidos
export type EmotionType = 'Neutro' | 'Alegre' | 'Reflexivo' | 'Tenso' | 'Empático' | 'Apaixonado' | 'Entusiasmado' | 'Cético';

interface AnalysisResult {
    myEmotion: { tone: EmotionType; intensity: number };
    partnerEmotion: { tone: EmotionType; intensity: number };
}

export const analyzeConversationEmotion = async (messages: Message[], currentUserId: string): Promise<AnalysisResult> => {
  // Simula processamento
  await new Promise(resolve => setTimeout(resolve, 500));

  if (messages.length === 0) {
      return {
          myEmotion: { tone: 'Neutro', intensity: 0 },
          partnerEmotion: { tone: 'Neutro', intensity: 0 }
      };
  }

  // Separa as mensagens
  const myMessages = messages.filter(m => m.sender_id === currentUserId).slice(-10); // Analisa as ultimas 10
  const partnerMessages = messages.filter(m => m.sender_id !== currentUserId).slice(-10);

  const analyzeText = (msgs: Message[]): { tone: EmotionType; intensity: number } => {
      if (msgs.length === 0) return { tone: 'Neutro', intensity: 0 };
      
      const text = msgs.map(m => m.content.toLowerCase()).join(' ');
      
      let tone: EmotionType = 'Neutro';
      let intensity = 20; // Base intensity

      // Dicionário de Sentimentos (Heurística)
      const keywords = {
          alegre: ['kkk', 'haha', 'lol', 'rs', 'legal', 'top', 'bom', 'ótimo', 'maravilha', 'show', 'feliz', 'sorrir', 'animado'],
          reflexivo: ['hmm', 'será', 'acho', 'talvez', 'pensando', 'vida', 'tempo', 'difícil', 'triste', 'pena', 'sinto', 'calma'],
          tenso: ['não', 'nada', 'droga', 'merda', 'aff', 'pq', 'por que', 'saco', 'odeio', 'chato', 'ruim', 'pare', 'basta'],
          empatico: ['entendo', 'verdade', 'pode crer', 'imagino', 'sinto muito', 'conte comigo', 'nós', 'juntos', 'tranquilo', 'obrigado', 'vlw'],
          apaixonado: ['amor', 'linda', 'lindo', 'amo', 'adoro', 'saudade', 'beijo', 'coração', 'paixão', 'gostoso', 'gostosa'],
          entusiasmado: ['vamos', 'bora', 'agora', 'incrível', 'demais', 'uau', 'caraca', 'meu deus', 'eita', 'correr', '!'],
          cetico: ['sei lá', 'duvido', 'estranho', 'serio?', 'mentira', 'hum']
      };

      // Contagem de pontos
      const scores: Record<string, number> = {};
      
      Object.entries(keywords).forEach(([key, words]) => {
          let count = 0;
          words.forEach(w => {
               // Regex simples para contar ocorrências
               const regex = new RegExp(`\\b${w}\\b`, 'gi');
               const matches = text.match(regex);
               if (matches) count += matches.length;
               // Bonus para pontuação e emojis (simplificado)
               if (text.includes('!') && key === 'entusiasmado') count += 1;
               if (text.includes('?') && key === 'reflexivo') count += 1;
          });
          scores[key] = count;
      });

      // Determina o vencedor
      let maxScore = 0;
      let winnerKey = 'neutro';

      Object.entries(scores).forEach(([key, score]) => {
          if (score > maxScore) {
              maxScore = score;
              winnerKey = key;
          }
      });

      // Mapeia para os tipos
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

      tone = map[winnerKey] || 'Neutro';
      
      // Calcula intensidade baseada na frequência e recência (simulada pelo slice anterior)
      intensity = Math.min(100, Math.max(20, 30 + (maxScore * 15)));

      return { tone, intensity };
  };

  return {
      myEmotion: analyzeText(myMessages),
      partnerEmotion: analyzeText(partnerMessages)
  };
};