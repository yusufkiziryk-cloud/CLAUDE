import { describe, expect, it } from "vitest";
import { CostEstimateSchema, type CanonicalGenerationRequest } from "@studio/domain";
import {
  ProviderManifestSchema,
  type MediaProviderAdapter,
  type ProviderJobStatus,
} from "@studio/provider-sdk";

export interface ContractSuiteOptions {
  /** Her test için taze adaptör örneği üretir (durum sızıntısını önler). */
  makeAdapter: () => MediaProviderAdapter;
  /** Adaptörün geçerli saydığı örnek istek. */
  validRequest: CanonicalGenerationRequest;
  /** Adaptörün 'unsupported' olarak işaretlemesi gereken istek. */
  unsupportedRequest: CanonicalGenerationRequest;
  /** succeeded durumuna ulaşmak için en fazla kaç poll denenir. */
  maxPolls?: number;
}

/**
 * Her sağlayıcı adaptörünün geçmek zorunda olduğu ortak sözleşme testi.
 * Yeni bir adaptör eklerken bu suite'i kendi test dosyanızdan çağırın.
 */
export function runProviderContractSuite(options: ContractSuiteOptions): void {
  const { makeAdapter, validRequest, unsupportedRequest, maxPolls = 20 } = options;

  describe("provider contract", () => {
    it("manifest şemaya uyar ve en az bir model bildirir", async () => {
      const manifest = await makeAdapter().manifest();
      const parsed = ProviderManifestSchema.parse(manifest);
      expect(parsed.models.length).toBeGreaterThan(0);
    });

    it("geçerli isteği kabul eder", () => {
      const result = makeAdapter().validate(validRequest);
      expect(result.issues).toEqual([]);
      expect(result.ok).toBe(true);
    });

    it("desteklenmeyen parametreyi SESSİZCE YUTMAZ — unsupported issue döner", () => {
      const result = makeAdapter().validate(unsupportedRequest);
      expect(result.ok).toBe(false);
      expect(result.issues.some((i) => i.kind === "unsupported")).toBe(true);
    });

    it("estimate şemaya uygun maliyet döner (kaynak ve tarih zorunlu)", async () => {
      const estimate = await makeAdapter().estimate(validRequest);
      const parsed = CostEstimateSchema.parse(estimate);
      expect(parsed.source.length).toBeGreaterThan(0);
    });

    it("compile deterministiktir", () => {
      const adapter = makeAdapter();
      expect(adapter.compile(validRequest)).toEqual(adapter.compile(validRequest));
    });

    it("compile çıktısı gizli anahtar içermez", () => {
      const compiled = makeAdapter().compile(validRequest);
      const serialized = JSON.stringify(compiled).toLowerCase();
      for (const needle of ["api_key", "apikey", "secret", "authorization", "bearer "]) {
        expect(serialized).not.toContain(needle);
      }
    });

    it("submit → getStatus yaşam döngüsü succeeded ile biter ve sonuç normalize edilir", async () => {
      const adapter = makeAdapter();
      const compiled = adapter.compile(validRequest);
      const job = await adapter.submit(compiled, {
        idempotencyKey: "contract-test-1",
        correlationId: "corr-1",
      });
      expect(job.externalJobId.length).toBeGreaterThan(0);

      let status: ProviderJobStatus = { state: "queued" };
      for (let i = 0; i < maxPolls; i++) {
        status = await adapter.getStatus(job);
        if (status.state === "succeeded" || status.state === "failed") break;
      }
      expect(status.state).toBe("succeeded");

      const result = await adapter.normalizeResult(status.raw);
      expect(result.artifacts.length).toBeGreaterThan(0);
      expect(result.provenance.providerId.length).toBeGreaterThan(0);
      expect(result.provenance.modelId.length).toBeGreaterThan(0);
    });

    it("aynı idempotency key ile ikinci submit aynı job'ı döner (çift ücret koruması)", async () => {
      const adapter = makeAdapter();
      const compiled = adapter.compile(validRequest);
      const ctx = { idempotencyKey: "contract-idem-1", correlationId: "corr-2" };
      const first = await adapter.submit(compiled, ctx);
      const second = await adapter.submit(compiled, ctx);
      expect(second.externalJobId).toBe(first.externalJobId);
    });

    it("mock sağlayıcılar sonuçlarını provenance.mock=true ile işaretler", async () => {
      const adapter = makeAdapter();
      const manifest = await adapter.manifest();
      const compiled = adapter.compile(validRequest);
      const job = await adapter.submit(compiled, {
        idempotencyKey: "contract-mock-flag",
        correlationId: "corr-3",
      });
      let status: ProviderJobStatus = { state: "queued" };
      for (let i = 0; i < maxPolls; i++) {
        status = await adapter.getStatus(job);
        if (status.state === "succeeded") break;
      }
      const result = await adapter.normalizeResult(status.raw);
      expect(result.provenance.mock).toBe(manifest.mock);
    });
  });
}
