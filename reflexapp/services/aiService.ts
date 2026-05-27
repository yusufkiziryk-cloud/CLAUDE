/**
 * AI Service — Local pattern-matching reflexology assistant
 * Optionally uses Anthropic API when user provides an API key
 */

import { ChatMessage } from '../types';
import { ALL_ZONES, SYMPTOM_ZONE_MAP } from '../constants/zones';

// ─── Local AI (Pattern Matching) ─────────────────────────────────────────────

interface AIResponse {
  content: string;
  suggestedZones: string[];
}

function detectLanguage(text: string): 'tr' | 'en' {
  const trChars = /[çğışöüÇĞİŞÖÜ]/;
  const trWords = /\b(ve|ile|için|ağrı|stres|yorgun|uyku|mide|baş)\b/i;
  return trChars.test(text) || trWords.test(text) ? 'tr' : 'en';
}

function findMatchingZones(input: string): string[] {
  const lower = input.toLowerCase();
  const matched = new Set<string>();

  for (const [keyword, zones] of Object.entries(SYMPTOM_ZONE_MAP)) {
    if (lower.includes(keyword.toLowerCase())) {
      zones.forEach((z) => matched.add(z));
    }
  }

  return Array.from(matched).slice(0, 4);
}

function buildZoneResponse(zoneIds: string[], lang: 'tr' | 'en'): string {
  const zones = zoneIds.map((id) => ALL_ZONES[id]).filter(Boolean);
  if (!zones.length) return '';

  const parts = zones.map((zone) => {
    const data = zone[lang];
    const benefit = data.benefits[0] ?? '';
    return lang === 'tr'
      ? `**${zone.emoji} ${data.name}** — ${data.location}\n_${benefit}_\n💆 ${data.technique.slice(0, 80)}...`
      : `**${zone.emoji} ${data.name}** — ${data.location}\n_${benefit}_\n💆 ${data.technique.slice(0, 80)}...`;
  });

  return parts.join('\n\n');
}

function generateLocalResponse(userInput: string, history: ChatMessage[]): AIResponse {
  const lang       = detectLanguage(userInput);
  const lower      = userInput.toLowerCase();
  const zoneIds    = findMatchingZones(lower);

  // ── Greeting ────────────────────────────────────────────────────────────────
  const greetings = ['merhaba', 'selam', 'hello', 'hi', 'hey'];
  if (greetings.some((g) => lower.includes(g))) {
    return {
      content: lang === 'tr'
        ? 'Merhaba! 🦶 Size nasıl yardımcı olabilirim?\n\nSemptomlarınızı söyleyin — sizin için özel refleksoloji noktaları bulayım.\n\nÖrnek:\n• "Başım ağrıyor"\n• "Stres içindeyim"\n• "Uyuyamıyorum"'
        : 'Hello! 🦶 How can I help you?\n\nTell me your symptoms and I\'ll find the right reflexology points for you.\n\nExamples:\n• "I have a headache"\n• "I\'m stressed"\n• "I can\'t sleep"',
      suggestedZones: [],
    };
  }

  // ── Safety / disclaimer ───────────────────────────────────────────────────
  const safetyWords = ['tehlikeli', 'zararlı', 'dangerous', 'harm', 'tedavi', 'hastalık', 'ilaç', 'medicine', 'doctor', 'doktor'];
  if (safetyWords.some((w) => lower.includes(w))) {
    return {
      content: lang === 'tr'
        ? '⚠️ **Önemli Bilgi**\n\nRefleksoloji tamamlayıcı bir terapidir. Tıbbi tanı, ilaç veya tedavinin yerini almaz.\n\nCiddi sağlık sorunları için lütfen bir sağlık uzmanına başvurun.\n\nRefleksoloji ile ilgili sorularınızı yanıtlamaktan memnuniyet duyarım!'
        : '⚠️ **Important Note**\n\nReflexology is a complementary therapy. It does not replace medical diagnosis, medication, or treatment.\n\nFor serious health concerns, please consult a healthcare professional.\n\nI\'m happy to answer your reflexology questions!',
      suggestedZones: [],
    };
  }

  // ── Zone-specific question ─────────────────────────────────────────────────
  const zoneKeywords = Object.keys(ALL_ZONES);
  for (const zoneId of zoneKeywords) {
    const zone = ALL_ZONES[zoneId];
    if (zone && (lower.includes(zone.tr.name.toLowerCase()) || lower.includes(zone.en.name.toLowerCase()))) {
      const data = zone[lang];
      return {
        content: lang === 'tr'
          ? `## ${zone.emoji} ${data.name}\n\n**📍 Konum:** ${data.location}\n\n**✨ Faydaları:**\n${data.benefits.map((b) => `• ${b}`).join('\n')}\n\n**💆 Teknik:** ${data.technique}\n\n${data.caution ? `⚠️ ${data.caution}` : ''}`
          : `## ${zone.emoji} ${data.name}\n\n**📍 Location:** ${data.location}\n\n**✨ Benefits:**\n${data.benefits.map((b) => `• ${b}`).join('\n')}\n\n**💆 Technique:** ${data.technique}\n\n${data.caution ? `⚠️ ${data.caution}` : ''}`,
        suggestedZones: [zoneId, ...(zone.relatedZones ?? [])].slice(0, 3),
      };
    }
  }

  // ── Symptom-based response ─────────────────────────────────────────────────
  if (zoneIds.length > 0) {
    const zoneResponse = buildZoneResponse(zoneIds, lang);
    const intro = lang === 'tr'
      ? `Belirttiğiniz semptom için **${zoneIds.length} refleksoloji noktası** öneriyorum:\n\n`
      : `For your symptoms, I recommend **${zoneIds.length} reflexology points**:\n\n`;
    const outro = lang === 'tr'
      ? '\n\n---\n_⚠️ Bu uygulama destekleyici rahatlama amaçlıdır. Tıbbi tanı veya tedavi yerine geçmez._'
      : '\n\n---\n_⚠️ This app is for supportive relaxation purposes. It does not replace medical diagnosis or treatment._';

    return {
      content:        intro + zoneResponse + outro,
      suggestedZones: zoneIds,
    };
  }

  // ── Technique questions ────────────────────────────────────────────────────
  const techWords = ['teknik', 'technique', 'nasıl', 'how', 'yapılır', 'do it', 'yürüyüş', 'walking', 'basınç', 'pressure'];
  if (techWords.some((w) => lower.includes(w))) {
    return {
      content: lang === 'tr'
        ? `## 💆 Temel Refleksoloji Teknikleri\n\n**1. Baş Parmak Yürüyüşü** 👍\nBaş parmağı hafifçe bükün ve tırtıl gibi küçük adımlarla ilerleyin. En temel ve etkili tekniktir.\n\n**2. Parmak Yürüyüşü** 👆\nİşaret parmağıyla daha hafif basınç için kullanılır.\n\n**3. Döndürme** 🔄\nBaş parmak ucuyla küçük daireler — küçük bölgeler için idealdir.\n\n**4. Sıkıştırma** 🤌\nNazik sıkıştırma — parmak uçları ve kulak memesi için.\n\n**5. Tutma** ✋\nSabit basınç ve tutma — enerji noktaları için.`
        : `## 💆 Core Reflexology Techniques\n\n**1. Thumb Walking** 👍\nBend the thumb slightly and advance in small caterpillar steps. The most fundamental and effective technique.\n\n**2. Finger Walking** 👆\nUsed for lighter pressure with the index finger.\n\n**3. Rotation** 🔄\nSmall circles with thumb tip — ideal for small areas.\n\n**4. Pinching** 🤌\nGentle squeeze — for toe tips and earlobes.\n\n**5. Holding** ✋\nSteady pressure and hold — for energy points.`,
      suggestedZones: [],
    };
  }

  // ── List zones ─────────────────────────────────────────────────────────────
  const listWords = ['listele', 'list', 'hepsi', 'all', 'göster', 'show', 'bölgeler', 'zones'];
  if (listWords.some((w) => lower.includes(w))) {
    const footZones = Object.values(ALL_ZONES).filter((z) => z.area === 'foot');
    const earZones  = Object.values(ALL_ZONES).filter((z) => z.area === 'ear');
    const content   = lang === 'tr'
      ? `## 🦶 Mevcut Refleksoloji Bölgeleri\n\n**Ayak Bölgeleri (${footZones.length}):**\n${footZones.map((z) => `${z.emoji} ${z.tr.name}`).join(' • ')}\n\n**Kulak Bölgeleri (${earZones.length}):**\n${earZones.map((z) => `${z.emoji} ${z.tr.name}`).join(' • ')}\n\nBir bölge hakkında daha fazla bilgi için adını yazın!`
      : `## 🦶 Available Reflexology Zones\n\n**Foot Zones (${footZones.length}):**\n${footZones.map((z) => `${z.emoji} ${z.en.name}`).join(' • ')}\n\n**Ear Zones (${earZones.length}):**\n${earZones.map((z) => `${z.emoji} ${z.en.name}`).join(' • ')}\n\nType the name of a zone to learn more!`;

    return { content, suggestedZones: [] };
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  return {
    content: lang === 'tr'
      ? 'Bunu anlayamadım 🙏 Lütfen bir semptom veya sağlık sorununu açıklayın.\n\nÖrnekler:\n• "Baş ağrısı"\n• "Stres ve anksiyete"\n• "Uyku problemi"\n• "Sırt ağrısı"\n• "Teknik nasıl yapılır?"'
      : 'I didn\'t understand that 🙏 Please describe a symptom or health concern.\n\nExamples:\n• "Headache"\n• "Stress and anxiety"\n• "Sleep problems"\n• "Back pain"\n• "How do I do the technique?"',
    suggestedZones: [],
  };
}

// ─── Anthropic API (Optional) ─────────────────────────────────────────────────

async function generateAnthropicResponse(
  userInput: string,
  history: ChatMessage[],
  apiKey: string
): Promise<AIResponse> {
  const systemPrompt = `You are Refleks, a warm and knowledgeable reflexology assistant. You help users with foot, hand, and ear reflexology.

IMPORTANT RULES:
1. You NEVER provide medical diagnoses or replace medical advice
2. Always end responses with: "⚠️ Bu uygulama destekleyici rahatlama amaçlıdır. Tıbbi tanı veya tedavi yerine geçmez."
3. Respond in the same language the user writes (Turkish or English)
4. Be warm, supportive, and detailed about reflexology points
5. When suggesting zones, mention location, technique, duration, and benefits
6. Keep responses concise but informative`;

  const messages = history
    .filter((m) => m.role !== 'system')
    .slice(-10)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  messages.push({ role: 'user', content: userInput });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':            'application/json',
      'x-api-key':               apiKey,
      'anthropic-version':       '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-opus-4-7',
      max_tokens: 1024,
      system:     systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text ?? '';

  // Extract suggested zones from the response
  const suggestedZones = Object.keys(ALL_ZONES).filter((id) =>
    content.toLowerCase().includes(ALL_ZONES[id]?.tr.name.toLowerCase() ?? '') ||
    content.toLowerCase().includes(ALL_ZONES[id]?.en.name.toLowerCase() ?? '')
  ).slice(0, 4);

  return { content, suggestedZones };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAIResponse(
  userInput:  string,
  history:    ChatMessage[],
  apiKey?:    string
): Promise<AIResponse> {
  // Use Anthropic API if key is provided
  if (apiKey && apiKey.startsWith('sk-ant')) {
    try {
      return await generateAnthropicResponse(userInput, history, apiKey);
    } catch (error) {
      console.warn('Anthropic API failed, falling back to local AI:', error);
    }
  }

  // Simulate network delay for realistic feel
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

  return generateLocalResponse(userInput, history);
}
