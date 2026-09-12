import request from "supertest";
import JSZip from "jszip";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
import type { ActivityBrief } from "../shared/types.js";
import { createApp } from "./app.js";
import { updateRuntimeSettings } from "./model.js";

const brief: ActivityBrief = {
  title: "新生见面会",
  type: "迎新见面",
  objective: "帮助新同学了解课程和班级资源",
  date: "2026-09-05",
  startTime: "14:00",
  endTime: "16:30",
  attendees: 50,
  budgetMin: 2800,
  budgetMax: 4000,
  location: "校内报告厅",
  venueType: "室内",
  teamMembers: [],
  mustHave: "班级介绍、新老生交流、合影",
  constraints: "需要投影和手持麦"
};

describe("HTTP API", () => {
  beforeEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("返回运行状态且不暴露密钥", async () => {
    const response = await request(createApp()).get("/api/health").expect(200);
    expect(response.body.ok).toBe(true);
    expect(typeof response.body.modelAvailable).toBe("boolean");
    expect(JSON.stringify(response.body)).not.toContain("apiKey");
  });

  it("端到端生成规则草案", async () => {
    const response = await request(createApp()).post("/api/plan").send({ brief, mode: "rules" }).expect(200);
    expect(response.body.meta.mode).toBe("rules");
    expect(response.body.plan.brief.title).toBe(brief.title);
    expect(response.body.plan.schedule.length).toBeGreaterThan(3);
    expect(response.body.plan.references.length).toBe(3);
  });

  it("拒绝缺少核心信息的请求", async () => {
    await request(createApp()).post("/api/plan").send({ brief: { ...brief, title: "" }, mode: "rules" }).expect(400);
  });

  it("可以下载历史活动来源材料", async () => {
    const sourceRoot = await mkdtemp(path.join(os.tmpdir(), "jiahui-source-"));
    const relativePath = "班级团建/2023秋团建/2023秋通班团建活动.docx";
    await mkdir(path.dirname(path.join(sourceRoot, relativePath)), { recursive: true });
    await writeFile(path.join(sourceRoot, relativePath), Buffer.alloc(2048, 1));
    try {
      const response = await request(createApp({ historySourceRoot: sourceRoot })).get("/api/knowledge/tongclass-2023-autumn/source/0").buffer(true).parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      }).expect(200);
      expect(response.headers["content-disposition"]).toContain("attachment");
      expect(response.body.length).toBeGreaterThan(1000);
    } finally {
      await rm(sourceRoot, { recursive: true, force: true });
    }
  });

  it("生成不含占位符的预填写经费表", async () => {
    const generated = await request(createApp()).post("/api/plan").send({ brief, mode: "rules" }).expect(200);
    const response = await request(createApp()).post("/api/forms/expense/prefilled").send({ plan: generated.body.plan }).buffer(true).parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    }).expect(200);
    const zip = await JSZip.loadAsync(response.body as Buffer);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain(brief.title);
    expect(xml).toContain(brief.location);
    expect(xml).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
  });
});

describe("官网接入 API", () => {
  const serviceToken = "test-internal-service-token-123456789";
  const headers = { Authorization: `Bearer ${serviceToken}`, "X-Request-ID": "request-test-1", "X-App-User-ID": "user-a" };

  it("接入模式不开放成员端模型设置", async () => {
    await request(createApp({ mode: "integrated", internalServiceToken: serviceToken })).get("/api/settings").expect(404);
  });

  it("拒绝没有内部服务凭据的业务请求", async () => {
    const response = await request(createApp({ mode: "integrated", internalServiceToken: serviceToken }))
      .get("/api/v1/knowledge")
      .set("X-Request-ID", "request-test-unauthorized")
      .set("X-App-User-ID", "user-a")
      .expect(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(response.body.error.requestId).toBe("request-test-unauthorized");
  });

  it("通过版本化接口生成规则草案", async () => {
    const response = await request(createApp({ mode: "integrated", internalServiceToken: serviceToken }))
      .post("/api/v1/plans/generate")
      .set(headers)
      .send({ brief, mode: "rules" })
      .expect(200);
    expect(response.body.plan.brief.title).toBe(brief.title);
    expect(response.headers["x-request-id"]).toBe("request-test-1");
  });

  it("异步任务完成后可由新进程状态重新读取", async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), "jiahui-jobs-"));
    try {
      const firstApp = createApp({ mode: "integrated", internalServiceToken: serviceToken, jobDataDir: dataDir });
      const created = await request(firstApp).post("/api/v1/jobs").set(headers)
        .send({ operation: "generate-plan", input: { brief, mode: "rules" } }).expect(202);
      const jobId = created.body.id as string;

      await request(firstApp).get(`/api/v1/jobs/${jobId}`).set({ ...headers, "X-App-User-ID": "user-b" }).expect(404);
      let status = "queued";
      for (let attempt = 0; attempt < 30 && status !== "succeeded"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const current = await request(firstApp).get(`/api/v1/jobs/${jobId}`).set(headers).expect(200);
        status = current.body.status;
      }
      expect(status).toBe("succeeded");

      const restartedApp = createApp({ mode: "integrated", internalServiceToken: serviceToken, jobDataDir: dataDir });
      const restored = await request(restartedApp).get(`/api/v1/jobs/${jobId}`).set(headers).expect(200);
      expect(restored.body.status).toBe("succeeded");
      expect(restored.body.result.plan.brief.title).toBe(brief.title);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("请求体超限时返回稳定错误码", async () => {
    const response = await request(createApp({ mode: "integrated", internalServiceToken: serviceToken }))
      .post("/api/v1/plans/generate")
      .set(headers)
      .send({ data: "x".repeat(2 * 1024 * 1024 + 1) })
      .expect(413);
    expect(response.body.error.code).toBe("REQUEST_TOO_LARGE");
    expect(response.body.error.requestId).toBe("request-test-1");
    expect(response.headers["x-request-id"]).toBe("request-test-1");
  });

  it("模型超时时返回可重试的 504", async () => {
    const upstream = createServer((_request, response) => {
      setTimeout(() => response.end(JSON.stringify({ choices: [{ message: { content: "{}" } }] })), 300);
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const address = upstream.address() as AddressInfo;
    process.env.AI_TIMEOUT_MS = "100";
    updateRuntimeSettings({ baseUrl: `http://127.0.0.1:${address.port}`, model: "mock-model", apiKey: "mock-key", reviewEnabled: false });
    try {
      const response = await request(createApp({ mode: "integrated", internalServiceToken: serviceToken }))
        .post("/api/v1/plans/generate")
        .set({ ...headers, "X-Request-ID": "request-timeout" })
        .send({ brief, mode: "model" })
        .expect(504);
      expect(response.body.error.code).toBe("MODEL_TIMEOUT");
      expect(response.body.error.retryable).toBe(true);
    } finally {
      delete process.env.AI_TIMEOUT_MS;
      updateRuntimeSettings({ baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", reviewEnabled: true, clearApiKey: true });
      await new Promise<void>((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("模型认证失败时返回明确的上游错误", async () => {
    const upstream = createServer((_request, response) => {
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "invalid key" } }));
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const address = upstream.address() as AddressInfo;
    updateRuntimeSettings({ baseUrl: `http://127.0.0.1:${address.port}`, model: "mock-model", apiKey: "mock-key", reviewEnabled: false });
    try {
      const response = await request(createApp({ mode: "integrated", internalServiceToken: serviceToken }))
        .post("/api/v1/plans/generate")
        .set({ ...headers, "X-Request-ID": "request-upstream-auth" })
        .send({ brief, mode: "model" })
        .expect(502);
      expect(response.body.error.code).toBe("MODEL_AUTH_FAILED");
      expect(response.body.error.retryable).toBe(false);
    } finally {
      updateRuntimeSettings({ baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", reviewEnabled: true, clearApiKey: true });
      await new Promise<void>((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("历史资料链接只接受配置的存储域名", async () => {
    process.env.R2_ALLOWED_HOSTS = "files.example.test";
    try {
      const response = await request(createApp({ mode: "integrated", internalServiceToken: serviceToken }))
        .post("/api/v1/knowledge/import")
        .set({ ...headers, "X-Request-ID": "request-file-host" })
        .send({ files: [{ name: "活动资料.md", url: "https://example.com/activity.md" }] })
        .expect(403);
      expect(response.body.error.code).toBe("FILE_SOURCE_NOT_ALLOWED");
    } finally {
      delete process.env.R2_ALLOWED_HOSTS;
    }
  });

  it("可以通过签名文件地址整理历史活动", async () => {
    const historySummary = {
      title: "历史迎新交流活动", year: 2025, activityType: "迎新交流", scale: 32, budget: 1200,
      venueType: "室内", tags: ["迎新", "交流"], summary: "面向新老同学开展的一次校内交流活动。",
      details: "活动在校内教室举行，包含简短介绍、自由交流和集体合影等环节。",
      evidence: ["材料记录了活动时间、地点和参加对象。"],
      reusableTips: ["提前收集到场情况并确认交流主题。"], pitfalls: ["通知中的集合点需要写清楚。"],
      timeline: ["活动前一周确认名单"], outcomes: ["完成活动资料归档"]
    };
    const upstream = createServer((request, response) => {
      if (request.url === "/activity.md") {
        response.writeHead(200, { "Content-Type": "text/markdown" });
        response.end("# 历史迎新活动\n时间：2025 年 9 月\n地点：校内教室\n内容：新老同学交流并合影。");
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(historySummary) } }] }));
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const address = upstream.address() as AddressInfo;
    process.env.R2_ALLOWED_HOSTS = "127.0.0.1";
    process.env.ALLOW_HTTP_FILE_URLS = "true";
    updateRuntimeSettings({ baseUrl: `http://127.0.0.1:${address.port}`, model: "mock-model", apiKey: "mock-key", reviewEnabled: false });
    try {
      const response = await request(createApp({ mode: "integrated", internalServiceToken: serviceToken }))
        .post("/api/v1/knowledge/import")
        .set({ ...headers, "X-Request-ID": "request-file-import" })
        .send({ files: [{ name: "历史迎新活动.md", url: `http://127.0.0.1:${address.port}/activity.md` }] })
        .expect(200);
      expect(response.body.case.title).toBe(historySummary.title);
      expect(response.body.parsedFiles).toEqual(["历史迎新活动.md"]);
    } finally {
      delete process.env.R2_ALLOWED_HOSTS;
      delete process.env.ALLOW_HTTP_FILE_URLS;
      updateRuntimeSettings({ baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", reviewEnabled: true, clearApiKey: true });
      await new Promise<void>((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
    }
  });
});
