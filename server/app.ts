import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import { z } from "zod";
import type { ActivityPlan, GeneratePlanResponse, KnowledgeCase } from "../shared/types.js";
import { blankExpenseFormPath, buildPrefilledExpenseForm } from "./expense-form.js";
import { parseHistoryFiles } from "./history-import.js";
import { knowledgeCases, retrieveCases, toReferenceInsights } from "./knowledge.js";
import {
  generateWithModel,
  getRuntimeSettings,
  isModelAvailable,
  modelName,
  refineWithModel,
  summarizeHistoryWithModel,
  testModelConnection,
  updateRuntimeSettings
} from "./model.js";
import { generateLocalPlan, refineLocalPlan } from "./planner.js";

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
});

const knowledgeCaseSchema = z.object({
  id: z.string().max(120),
  title: z.string().max(120),
  year: z.number().int(),
  activityType: z.string().max(60),
  scale: z.number().int().min(0).max(5000),
  budget: z.number().min(0).optional(),
  venueType: z.enum(["室内", "户外", "室内外结合", "待定"]),
  sourceFiles: z.array(z.string().max(300)).max(30),
  tags: z.array(z.string().max(40)).max(20),
  summary: z.string().max(1000),
  details: z.string().max(3000).optional(),
  evidence: z.array(z.string().max(800)).max(10),
  reusableTips: z.array(z.string().max(800)).max(10),
  pitfalls: z.array(z.string().max(800)).max(10),
  timeline: z.array(z.string().max(500)).max(10).optional(),
  outcomes: z.array(z.string().max(500)).max(10).optional(),
  imported: z.boolean().optional()
});

const generateSchema = z.object({
  brief: briefSchema,
  mode: z.enum(["model", "rules"]).optional().default("model"),
  knowledgeCases: z.array(knowledgeCaseSchema).max(30).optional()
});

const refineSchema = z.object({
  plan: z.record(z.string(), z.unknown()),
  instruction: z.string().trim().min(2).max(500)
});

const settingsSchema = z.object({
  baseUrl: z.string().trim().url().max(300),
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().max(500).optional(),
  clearApiKey: z.boolean().optional(),
  reviewEnabled: z.boolean()
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 30, fileSize: 8 * 1024 * 1024, fieldSize: 100_000 }
});

function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".") || "请求"}：${issue.message}`).join("；");
  }
  return error instanceof Error ? error.message : "服务暂时不可用";
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      modelAvailable: isModelAvailable(),
      model: modelName(),
      baseUrl: getRuntimeSettings().baseUrl,
      reviewEnabled: getRuntimeSettings().reviewEnabled,
      knowledgeCases: knowledgeCases.length
    });
  });

  app.get("/api/settings", (_request, response) => {
    response.json(getRuntimeSettings());
  });

  app.put("/api/settings", (request, response) => {
    try {
      response.json(updateRuntimeSettings(settingsSchema.parse(request.body)));
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post("/api/settings/test", async (_request, response) => {
    try {
      await testModelConnection();
      response.json({ ok: true, message: "连接成功" });
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.get("/api/knowledge", (_request, response) => {
    response.json({
      cases: knowledgeCases.map((item) => ({
        ...item,
        sourceFiles: item.sourceFiles.map((file) => file.split("/").pop())
      }))
    });
  });

  app.get("/api/knowledge/:caseId/source/:fileIndex", (request, response) => {
    const historyCase = knowledgeCases.find((item) => item.id === request.params.caseId);
    const index = Number(request.params.fileIndex);
    if (!historyCase || !Number.isInteger(index) || index < 0 || index >= historyCase.sourceFiles.length) {
      response.status(404).json({ error: "没有找到这份来源材料" });
      return;
    }
    const sourceRoot = path.resolve(process.cwd(), "过往活动相关文件/组织部");
    const sourcePath = path.resolve(sourceRoot, historyCase.sourceFiles[index]);
    if (!sourcePath.startsWith(`${sourceRoot}${path.sep}`)) {
      response.status(400).json({ error: "来源材料路径无效" });
      return;
    }
    response.download(sourcePath, path.basename(sourcePath), (error) => {
      if (error && !response.headersSent) response.status(404).json({ error: "本地来源材料不存在" });
    });
  });

  app.post("/api/knowledge/import", upload.array("files", 30), async (request, response) => {
    try {
      if (!isModelAvailable()) throw new Error("请先在运行配置中连接模型，再导入历史活动资料");
      const files = (request.files || []) as Express.Multer.File[];
      if (files.length === 0) throw new Error("没有收到可解析的文件");
      const { parsed, skipped } = await parseHistoryFiles(files);
      if (parsed.length === 0) throw new Error("当前支持 DOCX、XLSX、TXT、Markdown、CSV 和 JSON，请选择包含这些格式的资料");
      const summary = await summarizeHistoryWithModel(parsed);
      const historyCase: KnowledgeCase = {
        ...summary,
        id: `imported-${randomUUID()}`,
        sourceFiles: parsed.map((file) => file.name),
        imported: true
      };
      response.json({ case: historyCase, parsedFiles: parsed.map((file) => file.name), skippedFiles: skipped });
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post("/api/plan", async (request, response) => {
    try {
      const { brief, mode, knowledgeCases: customCases } = generateSchema.parse(request.body);
      if (brief.budgetMin > brief.budgetMax) throw new Error("预算下限不能高于预算上限");
      const localPlan = generateLocalPlan(brief);
      if (mode === "rules") {
        const payload: GeneratePlanResponse = {
          plan: localPlan,
          meta: { mode: "rules", message: "已生成基础草案。" }
        };
        response.json(payload);
        return;
      }
      if (!isModelAvailable()) throw new Error("请先在左下角运行配置中连接模型");
      const pool = [...knowledgeCases, ...((customCases || []) as KnowledgeCase[])];
      const cases = retrieveCases(brief, 3, pool);
      localPlan.references = toReferenceInsights(cases, brief);
      const plan = await generateWithModel(brief, localPlan, cases);
      const payload: GeneratePlanResponse = {
        plan,
        meta: { mode: "model", message: getRuntimeSettings().reviewEnabled ? "方案已生成，并完成一轮合理性复核。" : "方案已生成。" }
      };
      response.json(payload);
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.post("/api/refine", async (request, response) => {
    try {
      const { plan, instruction } = refineSchema.parse(request.body);
      const current = plan as unknown as ReturnType<typeof generateLocalPlan>;
      if (isModelAvailable()) {
        try {
          const refined = await refineWithModel(current, instruction);
          response.json({ plan: refined, meta: { mode: "model", message: "已根据反馈同步修改相关内容。" } });
          return;
        } catch (error) {
          response.status(400).json({ error: errorMessage(error) });
          return;
        }
      }
      response.json({
        plan: refineLocalPlan(current, instruction),
        meta: { mode: "rules", message: "未连接模型，已处理可识别的数字和地点调整。" }
      });
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.get("/api/forms/expense/blank", (_request, response) => {
    response.download(blankExpenseFormPath, "北京大学学生活动经费支出明细表-空白.docx");
  });

  app.post("/api/forms/expense/prefilled", async (request, response) => {
    try {
      const plan = request.body?.plan as ActivityPlan | undefined;
      if (!plan?.brief?.title || !Array.isArray(plan.budgetItems) || !Array.isArray(plan.schedule)) throw new Error("活动方案信息不完整");
      const file = await buildPrefilledExpenseForm(plan);
      response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
      response.send(file.buffer);
    } catch (error) {
      response.status(400).json({ error: errorMessage(error) });
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      response.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "单个文件不能超过 8 MB" : "上传文件过多或格式不正确" });
      return;
    }
    next(error);
  });

  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(dirname, "../../dist");
  app.use(express.static(distPath));
  app.get(/^(?!\/api\/).*/, (_request, response) => {
    response.sendFile(path.join(distPath, "index.html"));
  });

  return app;
}
