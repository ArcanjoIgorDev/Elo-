import { Message } from "../types";

// --- SIMULAÇÃO DE IA (Sem API Key) ---

export const analyzeConversationEmotion = async (messages: Message[]) => {
  // Simula um tempo de processamento para parecer que a IA está "pensando"
  await new Promise(resolve => setTimeout(resolve, 800));

  if (messages.length === 0) return { tone: 'Neutro', intensity: 0 };

  // Palavras-chave simples para "fingir" uma análise
  const text = messages.map(m => m.content.toLowerCase()).join(' ');
  
  let tone = 'Neutro';
  let intensity = 30;

  // Lógica básica de detecção de sentimento
  if (text.match(/(bom|feliz|kkk|haha|amo|top|legal|obrigado|ótimo|saudade)/)) {
      tone = 'Alegre';
      intensity = 75;
  } else if (text.match(/(triste|ruim|chato|droga|pena|sinto muito|cansado)/)) {
      tone = 'Reflexivo';
      intensity = 60;
  } else if (text.match(/(onde|quando|que horas|vamos|bora|chegando)/)) {
      tone = 'Planejamento';
      intensity = 50;
  } else if (text.match(/(te amo|paixão|linda|lindo|gostoso|gostosa|beijo)/)) {
      tone = 'Romântico';
      intensity = 90;
  } else if (text.match(/(você|vc|nós|gente)/)) {
      tone = 'Empático';
      intensity = 40;
  }

  // Adiciona uma leve variação aleatória para não ficar estático
  intensity = Math.min(100, Math.max(10, intensity + (Math.floor(Math.random() * 20) - 10)));

  return { tone, intensity };
};