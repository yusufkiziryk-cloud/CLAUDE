import type { ErrorEnvelope } from "@studio/domain";

/**
 * Ham sağlayıcı hatasını standart zarfa çevirir.
 * userMessage her zaman Türkçe ve eyleme dönüktür; ham ayrıntı developerMessage'ta kalır.
 */
export function toErrorEnvelope(
  error: unknown,
  options: { code?: string; retryable?: boolean; correlationId?: string } = {},
): ErrorEnvelope {
  const developerMessage = error instanceof Error ? error.message : String(error);
  return {
    code: options.code ?? "PROVIDER_ERROR",
    userMessage:
      "Üretim isteği sırasında bir hata oluştu. Girdileriniz kaydedildi; tekrar deneyebilirsiniz.",
    developerMessage,
    retryable: options.retryable ?? false,
    ...(options.correlationId !== undefined ? { correlationId: options.correlationId } : {}),
  };
}
