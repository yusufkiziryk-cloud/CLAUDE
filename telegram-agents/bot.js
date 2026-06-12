// Claude API ile calisan, birden fazla ajan/kisilik destekleyen Telegram bot.
//
// Calistirmadan once:
//   1) npm install
//   2) .env dosyasini olusturun (.env.example'i kopyalayin) ve token/anahtarlari girin
//   3) npm start
//
// Komutlar:
//   /start    -> karsilama ve menu
//   /ajanlar  -> ajan listesi (butonlarla secim)
//   /sifirla  -> mevcut sohbet gecmisini temizler

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const Anthropic = require("@anthropic-ai/sdk");
const { agents, DEFAULT_AGENT } = require("./agents");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";
const EFFORT = process.env.CLAUDE_EFFORT || "low"; // low | medium | high | max
const MAX_HISTORY = 20; // her sohbette saklanacak en fazla mesaj sayisi (kullanici+asistan)

if (!TELEGRAM_TOKEN) {
  console.error("HATA: TELEGRAM_BOT_TOKEN tanimli degil. .env dosyasini kontrol edin.");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("HATA: ANTHROPIC_API_KEY tanimli degil. .env dosyasini kontrol edin.");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const claude = new Anthropic(); // ANTHROPIC_API_KEY ortam degiskeninden okunur

// Sohbet durumu: her chatId icin secili ajan ve mesaj gecmisi (bellekte tutulur).
// Not: Surec yeniden baslatildiginda sifirlanir. Kalici olmasi icin bir DB ekleyebilirsiniz.
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { agent: DEFAULT_AGENT, history: [] });
  }
  return sessions.get(chatId);
}

function agentKeyboard() {
  // Her ajan icin bir buton (callback ile secim)
  const rows = Object.entries(agents).map(([key, a]) => [
    { text: a.name, callback_data: `use:${key}` },
  ]);
  return { reply_markup: { inline_keyboard: rows } };
}

function agentListText() {
  const lines = Object.entries(agents).map(
    ([key, a]) => `${a.name}\n  ${a.description}\n  Secmek icin: /kullan ${key}`
  );
  return "Mevcut ajanlar:\n\n" + lines.join("\n\n");
}

// Telegram mesaj limiti ~4096 karakter. Uzun yanitlari parcalara bol.
function splitMessage(text, size = 4000) {
  const parts = [];
  for (let i = 0; i < text.length; i += size) {
    parts.push(text.slice(i, i + size));
  }
  return parts;
}

async function sendLong(chatId, text) {
  for (const part of splitMessage(text)) {
    await bot.sendMessage(chatId, part);
  }
}

// Claude'a soru gonderir ve metin yanitini dondurur.
async function askClaude(agentKey, history) {
  const agent = agents[agentKey] || agents[DEFAULT_AGENT];
  const response = await claude.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: agent.system,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT },
    messages: history,
  });

  // Yalnizca metin bloklarini birlestir (thinking bloklarini atla).
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (response.stop_reason === "refusal") {
    return "Uzgunum, bu istegi guvenlik nedeniyle yanitlayamiyorum.";
  }
  return text || "(Bos yanit alindi, lutfen tekrar deneyin.)";
}

// /start
bot.onText(/^\/start/, (msg) => {
  const chatId = msg.chat.id;
  const s = getSession(chatId);
  const current = agents[s.agent].name;
  bot.sendMessage(
    chatId,
    `Merhaba! Ben Claude destekli bir Telegram botuyum ve birden fazla *ajanim* var.\n\n` +
      `Su an aktif ajan: *${current}*\n\n` +
      `• Bir ajan secmek icin asagidaki butonlari kullan ya da /ajanlar yaz.\n` +
      `• Sohbet gecmisini temizlemek icin /sifirla yaz.\n\n` +
      `Bir ajan sec, sonra mesaj yazmaya basla!`,
    { parse_mode: "Markdown", ...agentKeyboard() }
  );
});

// /ajanlar
bot.onText(/^\/ajanlar/, (msg) => {
  bot.sendMessage(msg.chat.id, agentListText(), agentKeyboard());
});

// /kullan <key>
bot.onText(/^\/kullan(?:\s+(\S+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const key = (match[1] || "").toLowerCase();
  if (!agents[key]) {
    bot.sendMessage(chatId, "Boyle bir ajan yok. /ajanlar ile listeyi gor.", agentKeyboard());
    return;
  }
  const s = getSession(chatId);
  s.agent = key;
  s.history = []; // ajan degisince gecmisi temizle
  bot.sendMessage(chatId, `Aktif ajan: ${agents[key].name}\n\nArtik yazabilirsin.`);
});

// /sifirla
bot.onText(/^\/sifirla/, (msg) => {
  const chatId = msg.chat.id;
  const s = getSession(chatId);
  s.history = [];
  bot.sendMessage(chatId, "Sohbet gecmisi temizlendi.");
});

// Buton secimleri (ajan secimi)
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data || "";
  if (data.startsWith("use:")) {
    const key = data.slice(4);
    if (agents[key]) {
      const s = getSession(chatId);
      s.agent = key;
      s.history = [];
      await bot.answerCallbackQuery(query.id, { text: `Secildi: ${agents[key].name}` });
      await bot.sendMessage(chatId, `Aktif ajan: ${agents[key].name}\n\nArtik yazabilirsin.`);
    } else {
      await bot.answerCallbackQuery(query.id, { text: "Gecersiz secim." });
    }
  }
});

// Normal mesajlar -> aktif ajana gonder
bot.on("message", async (msg) => {
  const text = msg.text;
  if (!text || text.startsWith("/")) return; // komutlari yukaridaki handlerlar isliyor

  const chatId = msg.chat.id;
  const s = getSession(chatId);

  s.history.push({ role: "user", content: text });
  // Gecmisi sinirla (en eski mesajlari at)
  if (s.history.length > MAX_HISTORY) {
    s.history = s.history.slice(-MAX_HISTORY);
  }

  bot.sendChatAction(chatId, "typing");

  try {
    const reply = await askClaude(s.agent, s.history);
    s.history.push({ role: "assistant", content: reply });
    await sendLong(chatId, reply);
  } catch (err) {
    console.error("Claude hatasi:", err?.message || err);
    await bot.sendMessage(
      chatId,
      "Bir hata olustu. Lutfen biraz sonra tekrar deneyin."
    );
  }
});

bot.on("polling_error", (err) => {
  console.error("Telegram polling hatasi:", err?.message || err);
});

console.log(`Bot calisiyor. Model: ${MODEL}, effort: ${EFFORT}`);
console.log("Ajanlar:", Object.keys(agents).join(", "));
