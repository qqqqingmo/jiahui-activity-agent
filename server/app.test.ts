import request from "supertest";
import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";
import type { ActivityBrief } from "../shared/types.js";
import { createApp } from "./app.js";

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
    const response = await request(createApp()).get("/api/knowledge/tongclass-2023-autumn/source/0").buffer(true).parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.body.length).toBeGreaterThan(1000);
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
