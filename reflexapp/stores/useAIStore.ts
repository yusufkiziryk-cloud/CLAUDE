import { create } from 'zustand';
import { ChatMessage, AIStoreState } from '../types';

let msgCounter = 0;
const uid = () => `msg_${Date.now()}_${++msgCounter}`;

const WELCOME_MESSAGE: ChatMessage = {
  id:        uid(),
  role:      'assistant',
  content:   'Merhaba! Ben Refleks 🦶 — refleksoloji asistanınızım.\n\nSize nasıl yardımcı olabilirim? Semptomlarınızı yazabilirsiniz:\n\n• "Başım ağrıyor"\n• "Çok stresliyim"\n• "Uyuyamıyorum"\n• "Midem kötü"\n\n*Bu uygulama destekleyici rahatlama amaçlıdır. Tıbbi tanı veya tedavi yerine geçmez.*',
  timestamp: new Date(),
};

export const useAIStore = create<AIStoreState>((set) => ({
  messages:  [WELCOME_MESSAGE],
  isTyping:  false,

  addUserMessage: (content) => {
    const msg: ChatMessage = {
      id:        uid(),
      role:      'user',
      content,
      timestamp: new Date(),
    };
    set((state) => ({ messages: [...state.messages, msg] }));
  },

  addAssistantMessage: (content, suggestedZones) => {
    const msg: ChatMessage = {
      id:             uid(),
      role:           'assistant',
      content,
      timestamp:      new Date(),
      suggestedZones,
    };
    set((state) => ({ messages: [...state.messages, msg], isTyping: false }));
  },

  setTyping: (v) => set({ isTyping: v }),

  clearChat: () => {
    set({ messages: [{ ...WELCOME_MESSAGE, id: uid(), timestamp: new Date() }] });
  },
}));
