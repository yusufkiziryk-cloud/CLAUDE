import { deflateSync } from "node:zlib";

/**
 * Bağımlılıksız, saf TypeScript PNG kodlayıcı (RGBA, 8 bit).
 * Mock sağlayıcının yer tutucuları FFmpeg/timeline ile uyumlu olsun diye
 * SVG yerine gerçek PNG üretilir.
 */
export function encodePng(
  width: number,
  height: number,
  pixelAt: (x: number, y: number) => [number, number, number, number],
): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filtre: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 6; // renk tipi: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

let crcTable: Uint32Array | null = null;

function crc32(buffer: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crcTable[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** MOCK yer tutucu karesi: koyu zemin + çapraz pembe şeritler (belirgin biçimde sentetik). */
export function buildPlaceholderPng(width = 640, height = 360): Buffer {
  return encodePng(width, height, (x, y) => {
    const stripe = Math.floor((x + y) / 24) % 2 === 0;
    const border = x < 8 || y < 8 || x >= width - 8 || y >= height - 8;
    if (border) return [233, 69, 96, 255]; // pembe çerçeve
    if (stripe) return [40, 42, 66, 255];
    return [26, 26, 46, 255];
  });
}
