import type { ProviderRegistry } from "@studio/provider-sdk";
import { MockProviderAdapter, MOCK_PROVIDER_ID } from "@studio/provider-mock";
import { FalProviderAdapter, FAL_PROVIDER_ID } from "@studio/provider-fal";
import { OpenAIProviderAdapter, OPENAI_PROVIDER_ID } from "@studio/provider-openai";
import { ReplicateProviderAdapter, REPLICATE_PROVIDER_ID } from "@studio/provider-replicate";
import { ElevenLabsProviderAdapter, ELEVENLABS_PROVIDER_ID } from "@studio/provider-elevenlabs";

export interface ProviderKeys {
  FAL_API_KEY?: string | undefined;
  OPENAI_API_KEY?: string | undefined;
  REPLICATE_API_TOKEN?: string | undefined;
  ELEVENLABS_API_KEY?: string | undefined;
}

/**
 * Yapılandırılmış sağlayıcıları kaydeder. Anahtarı olmayan gerçek sağlayıcı
 * KAYDEDİLMEZ — sahte/başarısız üretim yerine arayüzde hiç görünmez ve
 * eksik anahtar günlükte açıkça bildirilir. Mock her zaman kayıtlıdır.
 */
export function registerConfiguredProviders(
  registry: ProviderRegistry,
  keys: ProviderKeys,
  log: (message: string) => void = console.log,
): { registered: string[]; missingKeys: string[] } {
  const registered: string[] = [];
  const missingKeys: string[] = [];

  registry.register(MOCK_PROVIDER_ID, new MockProviderAdapter());
  registered.push(MOCK_PROVIDER_ID);

  if (keys.FAL_API_KEY) {
    registry.register(FAL_PROVIDER_ID, new FalProviderAdapter({ apiKey: keys.FAL_API_KEY }));
    registered.push(FAL_PROVIDER_ID);
  } else {
    missingKeys.push("FAL_API_KEY");
    log(
      "[providers] FAL_API_KEY tanımlı değil → fal.ai kayıtlı DEĞİL (yalnızca mock kullanılabilir).",
    );
  }

  if (keys.OPENAI_API_KEY) {
    registry.register(
      OPENAI_PROVIDER_ID,
      new OpenAIProviderAdapter({ apiKey: keys.OPENAI_API_KEY }),
    );
    registered.push(OPENAI_PROVIDER_ID);
  } else {
    missingKeys.push("OPENAI_API_KEY");
    log("[providers] OPENAI_API_KEY tanımlı değil → OpenAI kayıtlı DEĞİL.");
  }

  if (keys.REPLICATE_API_TOKEN) {
    registry.register(
      REPLICATE_PROVIDER_ID,
      new ReplicateProviderAdapter({ apiToken: keys.REPLICATE_API_TOKEN }),
    );
    registered.push(REPLICATE_PROVIDER_ID);
  } else {
    missingKeys.push("REPLICATE_API_TOKEN");
    log("[providers] REPLICATE_API_TOKEN tanımlı değil → Replicate kayıtlı DEĞİL.");
  }

  if (keys.ELEVENLABS_API_KEY) {
    registry.register(
      ELEVENLABS_PROVIDER_ID,
      new ElevenLabsProviderAdapter({ apiKey: keys.ELEVENLABS_API_KEY }),
    );
    registered.push(ELEVENLABS_PROVIDER_ID);
  } else {
    missingKeys.push("ELEVENLABS_API_KEY");
    log("[providers] ELEVENLABS_API_KEY tanımlı değil → ElevenLabs kayıtlı DEĞİL.");
  }

  return { registered, missingKeys };
}
