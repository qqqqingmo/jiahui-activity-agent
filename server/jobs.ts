import path from "node:path";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { ServiceJob, ServiceJobOperation } from "../shared/types.js";
import { apiErrorBody, AppError } from "./errors.js";

interface StoredJob extends ServiceJob {
  userId: string;
  requestId: string;
  input?: unknown;
}

export type JobExecutor = (operation: ServiceJobOperation, input: unknown) => Promise<unknown>;

export interface JobManagerOptions {
  dataDir?: string;
  concurrency?: number;
  retentionHours?: number;
  executor: JobExecutor;
}

function publicJob(job: StoredJob): ServiceJob {
  return {
    id: job.id,
    operation: job.operation,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    expiresAt: job.expiresAt,
    ...(job.result === undefined ? {} : { result: job.result }),
    ...(job.error === undefined ? {} : { error: job.error })
  };
}

export class JobManager {
  private readonly dataDir: string;
  private readonly concurrency: number;
  private readonly retentionHours: number;
  private readonly queueLimit: number;
  private readonly userActiveLimit: number;
  private readonly executor: JobExecutor;
  private readonly jobs = new Map<string, StoredJob>();
  private readonly queue: string[] = [];
  private active = 0;
  private lastCleanup = 0;
  private readonly initialized: Promise<void>;

  constructor(options: JobManagerOptions) {
    this.dataDir = path.resolve(options.dataDir || process.env.JOB_DATA_DIR || ".runtime/jobs");
    this.concurrency = Math.max(1, Math.min(8, options.concurrency || Number(process.env.JOB_CONCURRENCY) || 2));
    this.retentionHours = Math.max(1, Math.min(168, options.retentionHours || Number(process.env.JOB_RETENTION_HOURS) || 24));
    this.queueLimit = Math.max(1, Math.min(1_000, Number(process.env.JOB_QUEUE_LIMIT) || 100));
    this.userActiveLimit = Math.max(1, Math.min(100, Number(process.env.JOB_USER_ACTIVE_LIMIT) || 10));
    this.executor = options.executor;
    this.initialized = this.load();
  }

  private filePath(id: string) {
    return path.join(this.dataDir, `${id}.json`);
  }

  private async persist(job: StoredJob) {
    await mkdir(this.dataDir, { recursive: true });
    const target = this.filePath(job.id);
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(job), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, target);
  }

  private async load() {
    await mkdir(this.dataDir, { recursive: true });
    const now = Date.now();
    const names = await readdir(this.dataDir).catch(() => []);
    for (const name of names) {
      if (!/^[a-f0-9-]+\.json$/i.test(name)) continue;
      try {
        const job = JSON.parse(await readFile(path.join(this.dataDir, name), "utf8")) as StoredJob;
        const expectedId = name.slice(0, -5);
        if (job.id !== expectedId || !/^[a-f0-9-]{36}$/i.test(job.id)) continue;
        if (!["generate-plan", "refine-plan", "import-history"].includes(job.operation)) continue;
        if (!["queued", "running", "succeeded", "failed", "cancelled"].includes(job.status)) continue;
        if (typeof job.userId !== "string" || typeof job.requestId !== "string" || !Number.isFinite(new Date(job.expiresAt).getTime())) continue;
        if (new Date(job.expiresAt).getTime() <= now) {
          await unlink(path.join(this.dataDir, name)).catch(() => undefined);
          continue;
        }
        if (job.status === "running") {
          job.status = "queued";
          job.updatedAt = new Date().toISOString();
          await this.persist(job);
        }
        this.jobs.set(job.id, job);
        if (job.status === "queued") this.queue.push(job.id);
      } catch {
        // Ignore incomplete files; atomic writes make this exceptional.
      }
    }
    this.drain();
  }

  async create(operation: ServiceJobOperation, input: unknown, userId: string, requestId: string) {
    await this.initialized;
    await this.pruneExpired();
    const activeJobs = Array.from(this.jobs.values()).filter((job) => job.status === "queued" || job.status === "running");
    if (activeJobs.length >= this.queueLimit) throw new AppError("JOB_QUEUE_FULL", "任务队列已满，请稍后重试", 503, true);
    if (activeJobs.filter((job) => job.userId === userId).length >= this.userActiveLimit) {
      throw new AppError("USER_JOB_LIMIT", "当前用户进行中的任务过多，请稍后重试", 429, true);
    }
    const now = new Date();
    const job: StoredJob = {
      id: randomUUID(),
      operation,
      status: "queued",
      userId,
      requestId,
      input,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.retentionHours * 3_600_000).toISOString()
    };
    this.jobs.set(job.id, job);
    await this.persist(job);
    this.queue.push(job.id);
    this.drain();
    return publicJob(job);
  }

  async get(id: string, userId: string) {
    await this.initialized;
    await this.pruneExpired();
    const job = this.jobs.get(id);
    return job?.userId === userId ? publicJob(job) : undefined;
  }

  async cancel(id: string, userId: string) {
    await this.initialized;
    await this.pruneExpired();
    const job = this.jobs.get(id);
    if (!job || job.userId !== userId) return undefined;
    if (job.status === "queued" || job.status === "running") {
      job.status = "cancelled";
      job.updatedAt = new Date().toISOString();
      job.input = undefined;
      await this.persist(job);
    }
    return publicJob(job);
  }

  async readiness() {
    await this.initialized;
    await this.pruneExpired();
    return true;
  }

  private async pruneExpired() {
    const now = Date.now();
    if (now - this.lastCleanup < 300_000) return;
    this.lastCleanup = now;
    for (const [id, job] of this.jobs) {
      if (new Date(job.expiresAt).getTime() > now) continue;
      this.jobs.delete(id);
      await unlink(this.filePath(id)).catch(() => undefined);
    }
  }

  private drain() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const id = this.queue.shift();
      if (!id) return;
      const job = this.jobs.get(id);
      if (!job || job.status !== "queued") continue;
      this.active += 1;
      void this.run(job).finally(() => {
        this.active -= 1;
        this.drain();
      });
    }
  }

  private async run(job: StoredJob) {
    try {
      job.status = "running";
      job.updatedAt = new Date().toISOString();
      await this.persist(job);
      const result = await this.executor(job.operation, job.input);
      if (this.wasCancelled(job.id)) return;
      job.status = "succeeded";
      job.result = result;
    } catch (error) {
      if (this.wasCancelled(job.id)) return;
      job.status = "failed";
      job.error = apiErrorBody(error, job.requestId);
    } finally {
      if (!this.wasCancelled(job.id)) job.updatedAt = new Date().toISOString();
      job.input = undefined;
      await this.persist(job).catch(() => {
        if (process.env.NODE_ENV !== "test") {
          console.error(JSON.stringify({
            timestamp: new Date().toISOString(), event: "job_persist_failed", requestId: job.requestId,
            code: "JOB_PERSIST_FAILED"
          }));
        }
      });
    }
  }

  private wasCancelled(id: string) {
    return this.jobs.get(id)?.status === "cancelled";
  }
}
