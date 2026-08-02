/**
 * Nesne depolama soyutlaması. İki sürücü:
 *  - LocalDiskObjectStore: geliştirme/masaüstü (data/objects altında)
 *  - S3ObjectStore: S3 uyumlu servisler (MinIO, AWS S3) — docker compose ile
 * Varlık URI'leri istemciye her zaman API'nin /files servisi üzerinden verilir;
 * istemci depolama teknolojisini bilmez.
 */
export interface ObjectStore {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** İstemciye verilecek göreli yol (API bunu /files/* olarak servis eder). */
  publicPath(key: string): string;
}

const KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;

/** Path traversal ve tuhaf anahtarları reddeder. */
export function assertValidKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes("..")) {
    throw new Error(`Geçersiz nesne anahtarı: ${key}`);
  }
}

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  srt: "text/plain",
  vtt: "text/vtt",
};

export function mimeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

export function extFromMime(mimeType: string): string | null {
  const found = Object.entries(EXT_TO_MIME).find(([, mime]) => mime === mimeType);
  return found ? found[0] : null;
}
