import { randomUUID } from "node:crypto";
import type {
  ActivityPlan,
  GeneratePlanRequest,
  GeneratePlanResponse,
  HistoryImportResponse,
  KnowledgeCase,
  RefinePlanRequest
} from "../shared/types.js";
import type { ParsedHistoryFile } from "./history-import.js";
import { knowledgeCases, retrieveCases, toReferenceInsights } from "./knowledge.js";
import { generateWithModel, getRuntimeSettings, isModelAvailable, refineWithModel, summarizeHistoryWithModel } from "./model.js";
import { generateLocalPlan, refineLocalPlan } from "./planner.js";
import { AppError } from "./errors.js";

export async function generatePlan(input: GeneratePlanRequest): Promise<GeneratePlanResponse> {
  const { brief, mode = "model", knowledgeCases: customCases } = input;
  if (brief.budgetMin > brief.budgetMax) throw new AppError("INVALID_BUDGET_RANGE", "预算下限不能高于预算上限", 400);
  const localPlan = generateLocalPlan(brief);
  if (mode === "rules") {
    return { plan: localPlan, meta: { mode: "rules", message: "已生成基础草案。" } };
  }
  if (!isModelAvailable()) throw new AppError("MODEL_NOT_CONFIGURED", "模型服务尚未配置", 503);
  const pool = [...knowledgeCases, ...(customCases || [])];
  const cases = retrieveCases(brief, 3, pool);
  localPlan.references = toReferenceInsights(cases, brief);
  const generated = await generateWithModel(brief, localPlan, cases);
  return {
    plan: generated.plan,
    meta: {
      mode: "model",
      message: generated.reviewCompleted ? "方案已生成，并完成合理性复核。" : "方案已生成。",
      reviewRequested: getRuntimeSettings().reviewEnabled,
      reviewCompleted: generated.reviewCompleted
    }
  };
}

export async function refinePlan(input: RefinePlanRequest): Promise<GeneratePlanResponse> {
  if (isModelAvailable()) {
    const plan = await refineWithModel(input.plan, input.instruction);
    return { plan, meta: { mode: "model", message: "已根据反馈同步修改相关内容。" } };
  }
  return {
    plan: refineLocalPlan(input.plan, input.instruction),
    meta: { mode: "rules", message: "已处理可识别的数字和地点调整。" }
  };
}

export async function importHistory(parsed: ParsedHistoryFile[], skippedFiles: string[] = []): Promise<HistoryImportResponse> {
  if (!isModelAvailable()) throw new AppError("MODEL_NOT_CONFIGURED", "模型服务尚未配置", 503);
  if (parsed.length === 0) {
    throw new AppError("NO_SUPPORTED_FILES", "没有可解析的资料；支持 DOCX、XLSX、TXT、Markdown、CSV 和 JSON", 400);
  }
  const summary = await summarizeHistoryWithModel(parsed);
  const historyCase: KnowledgeCase = {
    ...summary,
    id: `imported-${randomUUID()}`,
    sourceFiles: parsed.map((file) => file.name),
    imported: true
  };
  return { case: historyCase, parsedFiles: parsed.map((file) => file.name), skippedFiles };
}

export function assertPlan(value: unknown): ActivityPlan {
  const plan = value as ActivityPlan | undefined;
  if (!plan?.brief?.title || !Array.isArray(plan.budgetItems) || !Array.isArray(plan.schedule)) {
    throw new AppError("INVALID_PLAN", "活动方案信息不完整", 400);
  }
  return plan;
}
