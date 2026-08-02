import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID } from "@studio/provider-mock";
import { LocalDiskObjectStore, MemoryStorageDriver, type ObjectStore } from "@studio/shared";
import { TemplateScriptGenerator } from "@studio/creative-engine";
import { buildServer } from "./server.js";
import { MemoryGenerationQueue } from "./queue.js";

const PASSWORD = "cok-gizli-parola";
let app: FastifyInstance;
let objectStore: ObjectStore;

beforeEach(() => {
  const storage = new MemoryStorageDriver();
  const registry = new ProviderRegistry();
  registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter());
  objectStore = new LocalDiskObjectStore(mkdtempSync(join(tmpdir(), "objects-")));
  app = buildServer({
    storage,
    registry,
    queue: new MemoryGenerationQueue({ storage, registry, objectStore, pollIntervalMs: 1 }),
    scriptGenerator: new TemplateScriptGenerator(),
    objectStore,
    rendersDir: mkdtempSync(join(tmpdir(), "renders-")),
    rateLimitPerMin: false,
    authPassword: PASSWORD,
  });
});

afterEach(async () => {
  await app.close();
});

async function login(password: string) {
  return app.inject({ method: "POST", url: "/auth/login", payload: { password } });
}

describe("V1: kimlik doğrulama", () => {
  it("token olmadan korumalı uçlar 401 döner", async () => {
    const res = await app.inject({ method: "GET", url: "/projects" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("UNAUTHORIZED");
  });

  it("yanlış parola 401, doğru parola token döner; token ile erişim açılır", async () => {
    expect((await login("yanlis")).statusCode).toBe(401);

    const ok = await login(PASSWORD);
    expect(ok.statusCode).toBe(200);
    const { token } = ok.json() as { token: string };
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const res = await app.inject({
      method: "GET",
      url: "/projects",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("geçersiz token 401 döner", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/projects",
      headers: { authorization: "Bearer " + "0".repeat(64) },
    });
    expect(res.statusCode).toBe(401);
  });

  it("/health ve GET /files/* kimlik istemez (medya etiketleri başlık gönderemez)", async () => {
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    await objectStore.put("acik/resim.png", Buffer.from("png"), "image/png");
    const media = await app.inject({ method: "GET", url: "/files/acik/resim.png" });
    expect(media.statusCode).toBe(200);
  });

  it("authPassword verilmezse hiçbir uç kimlik istemez (mevcut davranış)", async () => {
    const storage = new MemoryStorageDriver();
    const registry = new ProviderRegistry();
    registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter());
    const store = new LocalDiskObjectStore(mkdtempSync(join(tmpdir(), "objects-")));
    const openApp = buildServer({
      storage,
      registry,
      queue: new MemoryGenerationQueue({ storage, registry, objectStore: store }),
      scriptGenerator: new TemplateScriptGenerator(),
      objectStore: store,
      rendersDir: mkdtempSync(join(tmpdir(), "renders-")),
      rateLimitPerMin: false,
    });
    expect((await openApp.inject({ method: "GET", url: "/projects" })).statusCode).toBe(200);
    await openApp.close();
  });
});
