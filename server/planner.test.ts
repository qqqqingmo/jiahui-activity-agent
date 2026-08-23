import { describe, expect, it } from "vitest";
import type { ActivityBrief } from "../shared/types.js";
import { buildActivityProfile } from "./activity-profile.js";
import { retrieveCases } from "./knowledge.js";
import { generateLocalPlan, refineLocalPlan } from "./planner.js";

const brief: ActivityBrief = {
  title: "秋季集体团建",
  type: "集体团建",
  objective: "让新老同学熟悉彼此并完成一次协作任务",
  date: "2026-09-20",
  startTime: "08:30",
  endTime: "18:30",
  attendees: 45,
  budgetMin: 14000,
  budgetMax: 17000,
  location: "北京近郊营地",
  venueType: "户外",
  teamMembers: ["甲", "乙", "丙", "丁"],
  mustHave: "定向协作、集体合影",
  constraints: "下雨切换室内方案"
};

describe("本地规划引擎", () => {
  it("生成完整且预算闭合的活动方案", () => {
    const plan = generateLocalPlan(brief);
    expect(plan.schedule.length).toBeGreaterThanOrEqual(6);
    expect(plan.tasks.length).toBeGreaterThanOrEqual(6);
    expect(plan.materials.length).toBeGreaterThanOrEqual(6);
    expect(plan.risks.some((item) => item.item.includes("天气"))).toBe(true);
    const total = plan.budgetItems.reduce((sum, item) => sum + item.amount, 0);
    expect(total).toBeGreaterThanOrEqual(brief.budgetMin);
    expect(total).toBeLessThanOrEqual(brief.budgetMax);
    expect(plan.notices.initial).toContain(brief.title);
    expect(plan.references.length).toBe(3);
  });

  it("优先检索规模和场景相近的历史案例", () => {
    const cases = retrieveCases(brief);
    expect(cases[0].activityType).toBe("集体团建");
    expect(cases.some((item) => item.venueType === "户外")).toBe(true);
  });

  it("本地调整会同步更新人数和预算", () => {
    const original = generateLocalPlan(brief);
    const refined = refineLocalPlan(original, "人数改为 60 人，预算控制在 15000 元");
    expect(refined.brief.attendees).toBe(60);
    expect(refined.brief.budgetMax).toBe(15000);
    expect(refined.materials.find((item) => item.id === "material-water")?.quantity).toBeGreaterThanOrEqual(60);
    expect(refined.budgetItems.reduce((sum, item) => sum + item.amount, 0)).toBeLessThanOrEqual(15000);
  });

  it("轻量午餐参访不会套用大巴、比赛、奖品和彩排", () => {
    const plan = generateLocalPlan({
      ...brief,
      title: "禄岛猫咪午餐会",
      objective: "让新老同学去禄岛看看院长养的猫，拍摄猫咪照片，共进午餐交流熟悉彼此",
      startTime: "10:30",
      endTime: "14:00",
      location: "北京大学校内禄岛",
      venueType: "户外",
      budgetMin: 4500,
      budgetMax: 7000,
      mustHave: "看猫、自由拍摄、午餐交流、合影",
      constraints: "不使用闪光灯，不追逐或投喂猫咪"
    });
    const executionText = JSON.stringify({ schedule: plan.schedule, tasks: plan.tasks, materials: plan.materials, budget: plan.budgetItems, milestones: plan.milestones });
    expect(executionText).not.toMatch(/大巴|往返车辆|奖品|主题协作挑战|彩排/);
    expect(plan.schedule.map((item) => item.title)).toContain("核心体验与自由参与");
    expect(plan.schedule.map((item) => item.title)).toContain("午餐与自由交流");
    expect(plan.risks.some((item) => item.item.includes("动物"))).toBe(true);
    expect(JSON.stringify(plan.references)).not.toMatch(/大巴|车费|奖品|保险|登山/);
    expect(plan.decisions.find((item) => item.dimension === "交通安排")?.decision).toBe("不需要");
  });

  it.each([
    {
      name: "20 人校内读书交流",
      input: { title: "新书交流会", type: "学术交流" as const, objective: "围绕一本新书自由交流阅读感受", attendees: 20, location: "校内研讨室", venueType: "室内" as const, mustHave: "自由发言", constraints: "" },
      expected: { complexity: "轻量", transport: "不需要", grouping: "不需要", rehearsal: "不需要" }
    },
    {
      name: "200 人正式学生大会",
      input: { title: "年度学生大会", type: "学术交流" as const, objective: "完成年度报告、嘉宾分享和学生项目展示", attendees: 200, location: "校内报告厅", venueType: "室内" as const, mustHave: "嘉宾报告、项目展示、合影", constraints: "使用投影、麦克风和中控" },
      expected: { complexity: "复杂", transport: "不需要", grouping: "可选", rehearsal: "可选" }
    },
    {
      name: "校外徒步实践",
      input: { title: "近郊徒步实践", type: "志愿实践" as const, objective: "沿步道完成生态观察和垃圾清理", attendees: 36, location: "北京近郊步道", venueType: "户外" as const, mustHave: "分组徒步、生态观察", constraints: "统一包车往返" },
      expected: { complexity: "标准", transport: "需要", grouping: "需要", rehearsal: "不需要" }
    }
  ])("通用画像能区分 $name", ({ input, expected }) => {
    const profile = buildActivityProfile({ ...brief, ...input });
    expect(profile.complexity).toBe(expected.complexity);
    expect(profile.capabilities.transport).toBe(expected.transport);
    expect(profile.capabilities.grouping).toBe(expected.grouping);
    expect(profile.capabilities.rehearsal).toBe(expected.rehearsal);
  });
});
