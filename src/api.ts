import type {
  ActivityPlan,
  GeneratePlanRequest,
  GeneratePlanResponse,
  HealthResponse,
  HistoryImportResponse,
  KnowledgeCase,
  RefinePlanRequest,
  RuntimeSettings
} from "../shared/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "请求没有完成，请稍后再试");
  return payload as T;
}

async function download(url: string, filename: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...(init.headers || {}) } : init?.headers
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "文件下载失败" }));
    throw new Error(payload.error || "文件下载失败");
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export const api = {
  health: () => request<HealthResponse>("/api/health"),
  settings: () => request<RuntimeSettings>("/api/settings"),
  saveSettings: (body: Omit<RuntimeSettings, "hasApiKey"> & { apiKey?: string; clearApiKey?: boolean }) => request<RuntimeSettings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(body)
  }),
  testSettings: () => request<{ ok: boolean; message: string }>("/api/settings/test", { method: "POST" }),
  knowledge: () => request<{ cases: KnowledgeCase[] }>("/api/knowledge"),
  importHistory: (files: File[]) => {
    const body = new FormData();
    files.forEach((file) => body.append("files", file, file.webkitRelativePath || file.name));
    return request<HistoryImportResponse>("/api/knowledge/import", { method: "POST", body });
  },
  generate: (body: GeneratePlanRequest) => request<GeneratePlanResponse>("/api/plan", {
    method: "POST",
    body: JSON.stringify(body)
  }),
  refine: (body: RefinePlanRequest) => request<{ plan: ActivityPlan; meta: GeneratePlanResponse["meta"] }>("/api/refine", {
    method: "POST",
    body: JSON.stringify(body)
  }),
  downloadBlankExpenseForm: () => download("/api/forms/expense/blank", "北京大学学生活动经费支出明细表-空白.docx"),
  downloadPrefilledExpenseForm: (plan: ActivityPlan) => download(
    "/api/forms/expense/prefilled",
    `${plan.brief.title.replace(/[\\/:*?"<>|]/g, "-") || "活动"}-北京大学学生活动经费支出明细表.docx`,
    { method: "POST", body: JSON.stringify({ plan }) }
  )
};
