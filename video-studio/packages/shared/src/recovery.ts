import type { StorageDriver } from "./storage/types.js";

/**
 * Crash recovery: süreç yeniden başladığında "running" durumunda kalmış işler
 * sahipsizdir (ffmpeg/sağlayıcı takibi kayboldu). Bunlar açıkça 'failed' +
 * retryable olarak işaretlenir; kullanıcı tek tıkla yeniden başlatabilir.
 * Kuyrukta bekleyenlere dokunulmaz (BullMQ yeniden teslim eder).
 */
export async function recoverInterruptedJobs(
  storage: StorageDriver,
  log: (message: string) => void = () => {},
): Promise<{ generation: number; render: number }> {
  const runningGeneration = await storage.listGenerationJobsByStatus("running");
  for (const job of runningGeneration) {
    await storage.updateGenerationJob(job.id, {
      status: "failed",
      error: {
        code: "PROCESS_RESTARTED",
        userMessage:
          "Sunucu yeniden başlatıldığı için bu üretim yarıda kaldı. Tekrar deneyebilirsiniz.",
        retryable: true,
      },
      finishedAt: new Date().toISOString(),
    });
  }

  const runningRender = await storage.listRenderJobsByStatus("running");
  for (const job of runningRender) {
    await storage.updateRenderJob(job.id, {
      status: "failed",
      error: {
        code: "PROCESS_RESTARTED",
        userMessage:
          "Sunucu yeniden başlatıldığı için bu dışa aktarma yarıda kaldı. Tekrar deneyebilirsiniz.",
      },
      finishedAt: new Date().toISOString(),
    });
  }

  if (runningGeneration.length > 0 || runningRender.length > 0) {
    log(
      `[recovery] yarıda kalan işler işaretlendi: ${runningGeneration.length} üretim, ${runningRender.length} render`,
    );
  }
  return { generation: runningGeneration.length, render: runningRender.length };
}
