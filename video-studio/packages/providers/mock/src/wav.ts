/**
 * Bağımlılıksız, saf TypeScript WAV (PCM 16-bit mono) üretici.
 * Mock TTS/müzik yer tutucuları GERÇEK, çalınabilir ve FFmpeg-uyumlu ses dosyalarıdır;
 * içerik olarak konuşma DEĞİL, açıkça sentetik bip/akor desenleridir (MOCK etiketi
 * provenance.mock ile taşınır).
 */

const SAMPLE_RATE = 24000;

function wavHeader(dataLength: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // fmt boyutu
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // bayt/sn
  header.writeUInt16LE(2, 32); // blok hizalama
  header.writeUInt16LE(16, 34); // bit derinliği
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataLength, 40);
  return header;
}

function renderSamples(durationSec: number, sampleAt: (t: number) => number): Buffer {
  const count = Math.floor(durationSec * SAMPLE_RATE);
  const data = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const value = Math.max(-1, Math.min(1, sampleAt(t)));
    data.writeInt16LE(Math.round(value * 32767 * 0.6), i * 2);
  }
  return Buffer.concat([wavHeader(data.length), data]);
}

/**
 * Mock "seslendirme": kelime ritminde yumuşak bip desenleri.
 * Süre, Türkçe konuşma hızına (~2,3 kelime/sn) göre metin uzunluğundan türetilir.
 */
export function buildMockNarrationWav(text: string): { wav: Buffer; durationSec: number } {
  const words = Math.max(1, text.split(/\s+/).filter(Boolean).length);
  const durationSec = Math.min(60, Math.max(1, words / 2.3));
  const wav = renderSamples(durationSec, (t) => {
    const wordPhase = (t * 2.3) % 1; // kelime ritmi
    const envelope = wordPhase < 0.7 ? Math.sin((wordPhase / 0.7) * Math.PI) : 0;
    const base = Math.sin(2 * Math.PI * 220 * t) * 0.7 + Math.sin(2 * Math.PI * 440 * t) * 0.3;
    return base * envelope * 0.5;
  });
  return { wav, durationSec: Math.round(durationSec * 100) / 100 };
}

/** Mock "müzik": basit arpejli akor döngüsü. */
export function buildMockMusicWav(durationSec: number): { wav: Buffer; durationSec: number } {
  const clamped = Math.min(60, Math.max(1, durationSec));
  const notes = [261.63, 329.63, 392.0, 523.25]; // C-E-G-C arpej
  const wav = renderSamples(clamped, (t) => {
    const step = Math.floor(t * 4) % notes.length;
    const notePhase = (t * 4) % 1;
    const envelope = Math.exp(-notePhase * 3);
    return Math.sin(2 * Math.PI * (notes[step] as number) * t) * envelope * 0.5;
  });
  return { wav, durationSec: clamped };
}
