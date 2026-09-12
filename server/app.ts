import path from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import { z } from "zod";
import type { ActivityPlan, ServiceJobOperation } from "../shared/types.js";
import { blankExpenseFormPath, buildPrefilledExpenseForm } from "./expense-form.js";
import { apiErrorBody, AppError, toAppError, validationMessage } from "./errors.js";
import { parseHistoryFiles } from "./history-import.js";
import { JobManager, type JobExecutor } from "./jobs.js";
import { knowledgeCases } from "./knowledge.js";
import {
  activityPlanSchema,
  getRuntimeSettings,
  isModelAvailable,
  modelName,
  testModelConnection,
  updateRuntimeSettings
} from "./model.js";
import { downloadRemoteFiles } from "./remote-files.js";
import { assertPlan, generatePlan, importHistory, refinePlan } from "./service.js";

const serviceVersion = "1.1.0";
export type DeploymentMode = "standalone" | "integrated";

const briefSchema = z.object({
  title: z.string().trim().min(2).max(80),
  type: z.enum(["集体团建", "迎新见面", "学术交流", "晚会庆典", "比赛路演", "志愿实践", "其他"]),
  objective: z.string().trim().min(2).max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  attendees: z.number().int().min(1).max(5000),
  budgetMin: z.number().min(0).max(100_000_000),
  budgetMax: z.number().min(0).max(100_000_000),
  location: z.string().trim().max(120),
  venueType: z.enum(["室内", "户外", "室内外结合", "待定"]),
  teamMembers: z.array(z.string().trim().min(1).max(30)).max(30),
  mustHave: z.string().trim().max(500),
  constraints: z.string().trim().max(800)
}).strict();

const knowledgeCaseSchema = z.object({
  id: z.string().max(120), title: z.string().max(120), year: z.number().int(), activityType: z.string().max(60),
  scale: z.number().int().min(0).max(5000), budget: z.number().min(0).optional(),
  venueType: z.enum(["室内", "户外", "室内外结合", "待定"]), sourceFiles: z.array(z.string().max(300)).max(30),
  tags: z.array(z.string().max(40)).max(20), summary: z.string().max(1000), details: z.string().max(3000).optional(),
  evidence: z.array(z.string().max(800)).max(10), reusableTips: z.array(z.string().max(800)).max(10),
  pitfalls: z.array(z.string().max(800)).max(10), timeline: z.array(z.string().max(500)).max(10).optional(),
  outcomes: z.array(z.string().max(500)).max(10).optional(), imported: z.boolean().optional()
}).strict();

const generateSchema = z.object({
  brief: briefSchema,
  mode: z.enum(["model", "rules"]).optional().default("model"),
  knowledgeCases: z.array(knowledgeCaseSchema).max(30).optional()
}).strict();

const refineSchema = z.object({
  plan: activityPlanSchema,
  instruction: z.string().trim().min(2).max(500)
}).strict();

const settingsSchema = z.object({
  baseUrl: z.string().trim().url().max(300), model: z.string().trim().min(1).max(120),
  apiKey: z.string().max(500).optional(), clearApiKey: z.boolean().optional(), reviewEnabled: z.boolean()
}).strict();

const remoteFileSchema = z.object({
  name: z.string().trim().min(1).max(240),
  url: z.string().url().max(4096),
  contentType: z.string().max(160).optional(),
  size: z.number().int().min(0).max(8 * 1024 * 1024).optional()
}).strict();
const importUrlSchema = z.object({ files: z.array(remoteFileSchema).min(1).max(30) }).strict();

const jobSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("generate-plan"), input: generateSchema }).strict(),
  z.object({ operation: z.literal("refine-plan"), input: refineSchema }).strict(),
  z.object({ operation: z.literal("import-history"), input: importUrlSchema }).strict()
]);

const upload = multer({ storage: multer.memoryStorage(), limits: { files: 30, fileSize: 8 * 1024 * 1024, fieldSize: 100_000 } });

export interface AppOptions {
  mode?: DeploymentMode;
  internalServiceToken?: string;
  historySourceRoot?: string;
  jobDataDir?: string;
  jobExecutor?: JobExecutor;
}

function legacyMessage(error: unknown) {
  if (error instanceof z.ZodError) return validationMessage(error);
  return error instanceof Error ? error.message : "服务暂时不可用";
}

function tokenMatches(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function createApp(options: AppOptions = {}) {
  const configuredMode = options.mode || process.env.JIAHUI_DEPLOYMENT_MODE || "standalone";
  if (configuredMode !== "standalone" && configuredMode !== "integrated") {
    throw new AppError("INVALID_DEPLOYMENT_MODE", "JIAHUI_DEPLOYMENT_MODE 只能是 standalone 或 integrated", 500);
  }
  const mode: DeploymentMode = configuredMode;
  const internalServiceToken = options.internalServiceToken ?? process.env.INTERNAL_SERVICE_TOKEN?.trim() ?? "";
  const serviceAuthConfigured = internalServiceToken.length >= 32;
  const historySourceRoot = path.resolve(options.historySourceRoot || path.join(process.cwd(), "过往活动相关文件/组织部"));

  const executeJob: JobExecutor = options.jobExecutor || (async (operation: ServiceJobOperation, input: unknown) => {
    if (operation === "generate-plan") return generatePlan(input as Parameters<typeof generatePlan>[0]);
    if (operation === "refine-plan") {
      const parsed = refineSchema.parse(input);
      return refinePlan({ plan: parsed.plan as ActivityPlan, instruction: parsed.instruction });
    }
    const { files: references } = importUrlSchema.parse(input);
    const files = await downloadRemoteFiles(references);
    const { parsed, skipped } = await parseHistoryFiles(files);
    return importHistory(parsed, skipped);
  });
  const jobs = new JobManager({ dataDir: options.jobDataDir, executor: executeJob });

  const app = express();
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const supplied = request.get("x-request-id") || "";
    const requestId = /^[A-Za-z0-9._:-]{1,128}$/.test(supplied) ? supplied : randomUUID();
    response.locals.requestId = requestId;
    response.locals.suppliedRequestId = supplied;
    response.setHeader("X-Request-ID", requestId);
    const started = performance.now();
    response.on("finish", () => {
      if (process.env.NODE_ENV === "test") return;
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(), requestId, method: request.method,
        path: request.originalUrl.split("?", 1)[0], status: response.statusCode, durationMs: Math.round(performance.now() - started)
      }));
    });
    next();
  });
  app.use(express.json({ limit: "2mb" }));

  const requireInternalService: express.RequestHandler = (request, response, next) => {
    if (!serviceAuthConfigured) {
      next(new AppError("SERVICE_AUTH_NOT_CONFIGURED", "内部服务认证尚未配置", 503));
      return;
    }
    const authorization = request.get("authorization") || "";
    const presented = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!presented || !tokenMatches(presented, internalServiceToken)) {
      next(new AppError("UNAUTHORIZED", "内部服务认证失败", 401));
      return;
    }
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(response.locals.suppliedRequestId)) {
      next(new AppError("INVALID_REQUEST_ID", "缺少有效的 X-Request-ID", 400));
      return;
    }
    const userId = request.get("x-app-user-id") || "";
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(userId)) {
      next(new AppError("INVALID_USER_ID", "缺少有效的 X-App-User-ID", 400));
      return;
    }
    response.locals.userId = userId;
    next();
  };

  app.get("/api/v1/health/live", (_request, response) => {
    response.json({ ok: true, service: "jiahui", version: serviceVersion, mode });
  });

  app.get("/api/v1/health/ready", async (_request, response) => {
    const checks = {
      serviceAuth: serviceAuthConfigured,
      model: isModelAvailable(),
      jobStorage: await jobs.readiness().catch(() => false)
    };
    const ok = checks.jobStorage && (mode !== "integrated" || (checks.serviceAuth && checks.model));
    response.status(ok ? 200 : 503).json({ ok, service: "jiahui", version: serviceVersion, mode, checks });
  });

  const v1 = express.Router();
  v1.use(requireInternalService);

  v1.get("/knowledge", (_request, response) => {
    response.json({ cases: knowledgeCases.map((item) => ({ ...item, sourceFiles: item.sourceFiles.map((file) => path.basename(file)) })) });
  });

  v1.post("/knowledge/import", async (request, response) => {
    const { files: references } = importUrlSchema.parse(request.body);
    const files = await downloadRemoteFiles(references);
    const { parsed, skipped } = await parseHistoryFiles(files);
    response.json(await importHistory(parsed, skipped));
  });

  v1.post("/plans/generate", async (request, response) => {
    response.json(await generatePlan(generateSchema.parse(request.body)));
  });

  v1.post("/plans/refine", async (request, response) => {
    const parsed = refineSchema.parse(request.body);
    response.json(await refinePlan({ plan: parsed.plan as ActivityPlan, instruction: parsed.instruction }));
  });

  v1.get("/forms/expense/blank", (_request, response) => {
    response.download(blankExpenseFormPath, "北京大学学生活动经费支出明细表-空白.docx");
  });

  v1.post("/forms/expense/prefilled", async (request, response) => {
    const file = await buildPrefilledExpenseForm(assertPlan(activityPlanSchema.parse(request.body?.plan)));
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    response.send(file.buffer);
  });

  v1.post("/jobs", async (request, response) => {
    const parsed = jobSchema.parse(request.body);
    const job = await jobs.create(parsed.operation, parsed.input, response.locals.userId, response.locals.requestId);
    response.status(202).location(`/api/v1/jobs/${job.id}`).json(job);
  });

  v1.get("/jobs/:jobId", async (request, response) => {
    const job = await jobs.get(request.params.jobId, response.locals.userId);
    if (!job) throw new AppError("JOB_NOT_FOUND", "没有找到这项任务", 404);
    response.json(job);
  });

  v1.delete("/jobs/:jobId", async (request, response) => {
    const job = await jobs.cancel(request.params.jobId, response.locals.userId);
    if (!job) throw new AppError("JOB_NOT_FOUND", "没有找到这项任务", 404);
    response.json(job);
  });

  app.use("/api/v1", v1);

  if (mode === "standalone") {
    app.get("/api/health", (_request, response) => {
      response.json({
        ok: true, modelAvailable: isModelAvailable(), model: modelName(), baseUrl: getRuntimeSettings().baseUrl,
        reviewEnabled: getRuntimeSettings().reviewEnabled, knowledgeCases: knowledgeCases.length
      });
    });
    app.get("/api/settings", (_request, response) => response.json(getRuntimeSettings()));
    app.put("/api/settings", (request, response) => {
      try { response.json(updateRuntimeSettings(settingsSchema.parse(request.body))); }
      catch (error) { response.status(400).json({ error: legacyMessage(error) }); }
    });
    app.post("/api/settings/test", async (_request, response) => {
      try { await testModelConnection(); response.json({ ok: true, message: "连接成功" }); }
      catch (error) { response.status(toAppError(error).status).json({ error: legacyMessage(error) }); }
    });
    app.get("/api/knowledge", (_request, response) => {
      response.json({ cases: knowledgeCases.map((item) => ({ ...item, sourceFiles: item.sourceFiles.map((file) => path.basename(file)) })) });
    });
    app.get("/api/knowledge/:caseId/source/:fileIndex", (request, response) => {
      const historyCase = knowledgeCases.find((item) => item.id === request.params.caseId);
      const index = Number(request.params.fileIndex);
      if (!historyCase || !Number.isInteger(index) || index < 0 || index >= historyCase.sourceFiles.length) {
        response.status(404).json({ error: "没有找到这份来源材料" }); return;
      }
      const sourcePath = path.resolve(historySourceRoot, historyCase.sourceFiles[index]);
      if (!sourcePath.startsWith(`${historySourceRoot}${path.sep}`)) {
        response.status(400).json({ error: "来源材料路径无效" }); return;
      }
      response.download(sourcePath, path.basename(sourcePath), (error) => {
        if (error && !response.headersSent) response.status(404).json({ error: "本地来源材料不存在" });
      });
    });
    app.post("/api/knowledge/import", upload.array("files", 30), async (request, response) => {
      try {
        const files = (request.files || []) as Express.Multer.File[];
        if (files.length === 0) throw new AppError("NO_FILES", "没有收到可解析的文件", 400);
        const { parsed, skipped } = await parseHistoryFiles(files);
        response.json(await importHistory(parsed, skipped));
      } catch (error) { response.status(toAppError(error).status).json({ error: legacyMessage(error) }); }
    });
    app.post("/api/plan", async (request, response) => {
      try { response.json(await generatePlan(generateSchema.parse(request.body))); }
      catch (error) { response.status(toAppError(error).status).json({ error: legacyMessage(error) }); }
    });
    app.post("/api/refine", async (request, response) => {
      try {
        const parsed = refineSchema.parse(request.body);
        response.json(await refinePlan({ plan: parsed.plan as ActivityPlan, instruction: parsed.instruction }));
      } catch (error) { response.status(toAppError(error).status).json({ error: legacyMessage(error) }); }
    });
    app.get("/api/forms/expense/blank", (_request, response) => response.download(blankExpenseFormPath, "北京大学学生活动经费支出明细表-空白.docx"));
    app.post("/api/forms/expense/prefilled", async (request, response) => {
      try {
        const file = await buildPrefilledExpenseForm(assertPlan(activityPlanSchema.parse(request.body?.plan)));
        response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
        response.send(file.buffer);
      } catch (error) { response.status(toAppError(error).status).json({ error: legacyMessage(error) }); }
    });

    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const distPath = path.resolve(dirname, "../../dist");
    app.use(express.static(distPath));
    app.get(/^(?!\/api\/).*/, (_request, response) => response.sendFile(path.join(distPath, "index.html")));
  }

  app.use("/api/v1", (_request, _response, next) => next(new AppError("NOT_FOUND", "接口不存在", 404)));
  app.use("/api", (_request, _response, next) => next(new AppError("NOT_FOUND", "接口不存在", 404)));
  app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
    let normalized: unknown = error;
    if (error instanceof multer.MulterError) {
      normalized = new AppError(error.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "INVALID_UPLOAD", error.code === "LIMIT_FILE_SIZE" ? "单个文件不能超过 8 MB" : "上传文件过多或格式不正确", 413);
    } else if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
      normalized = new AppError("REQUEST_TOO_LARGE", "请求内容超过 2 MB", 413);
    } else if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.parse.failed") {
      normalized = new AppError("INVALID_REQUEST", "请求内容不是合法的 JSON", 400);
    }
    const appError = toAppError(normalized);
    if (appError.status >= 500 && process.env.NODE_ENV !== "test") {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(), event: "request_error", requestId: response.locals.requestId,
        code: appError.code, status: appError.status
      }));
    }
    if (mode === "integrated" || request.originalUrl.startsWith("/api/v1/")) {
      response.status(appError.status).json({ error: apiErrorBody(appError, response.locals.requestId || randomUUID()) });
      return;
    }
    response.status(appError.status).json({ error: legacyMessage(appError) });
  });

  return app;
}
