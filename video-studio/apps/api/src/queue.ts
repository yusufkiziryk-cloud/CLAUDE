import { Queue } from "bullmq";
import { processGenerationJob, type ProcessorDeps } from "@studio/shared";

export const GENERATION_QUEUE_NAME = "generation";

/** Kuyruk soyutlaması: API job'ı yalnızca 'enqueue' eder, işleme yerini bilmez. */
export interface GenerationQueue {
  enqueue(jobId: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Süreç içi kuyruk (QUEUE_DRIVER=memory): harici servis gerektirmez.
 * İşler aynı süreçte, istek yanıtlandıktan sonra asenkron işlenir.
 */
export class MemoryGenerationQueue implements GenerationQueue {
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly deps: ProcessorDeps) {}

  async enqueue(jobId: string): Promise<void> {
    const run = processGenerationJob(jobId, this.deps).catch((error) => {
      // processGenerationJob kendi hatalarını job'a yazar; buraya düşen beklenmedik hatadır.
      console.error("Kuyruk işleme hatası:", jobId, error);
    });
    this.pending.add(run);
    void run.finally(() => this.pending.delete(run));
  }

  /** Testlerde ve kapanışta bekleyen işlerin bitmesini bekler. */
  async drain(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.allSettled([...this.pending]);
    }
  }

  async close(): Promise<void> {
    await this.drain();
  }
}

/** BullMQ üretici (QUEUE_DRIVER=redis): işleme apps/worker sürecinde yapılır. */
export class RedisGenerationQueue implements GenerationQueue {
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(GENERATION_QUEUE_NAME, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: false,
      },
    });
  }

  async enqueue(jobId: string): Promise<void> {
    // jobId aynı zamanda BullMQ job id'sidir → aynı işin iki kez kuyruklanması engellenir.
    await this.queue.add("process", { jobId }, { jobId });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
