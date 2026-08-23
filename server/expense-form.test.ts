import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { ActivityBrief } from "../shared/types.js";
import { buildPrefilledExpenseForm, formatExpenseAmount, formatExpenseDate } from "./expense-form.js";
import { generateLocalPlan } from "./planner.js";

const brief: ActivityBrief = {
  title: "秋季交流活动",
  type: "迎新见面",
  objective: "让新老同学交流课程与校园生活经验",
  date: "2026-09-08",
  startTime: "11:30",
  endTime: "14:00",
  attendees: 28,
  budgetMin: 1800,
  budgetMax: 2600,
  location: "北京大学校内",
  venueType: "室内",
  teamMembers: ["林同学", "周同学"],
  mustHave: "午餐交流、校园参访、集体合影",
  constraints: "不安排车辆接送"
};

describe("经费支出明细表", () => {
  it("沿用历史表的日期和金额格式", () => {
    expect(formatExpenseDate("2026-09-08")).toBe("2026.9.8");
    expect(formatExpenseAmount(1200)).toBe("1200");
    expect(formatExpenseAmount(89.5)).toBe("89.5");
    expect(formatExpenseAmount(89.56)).toBe("89.56");
  });

  it("活动内容分三项概括，不写分时流程", async () => {
    const plan = generateLocalPlan(brief);
    const result = await buildPrefilledExpenseForm(plan);
    const zip = await JSZip.loadAsync(result.buffer);
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).toContain("2026.9.8");
    expect(xml).toContain("活动目的及意义：让新老同学交流课程与校园生活经验。");
    expect(xml).toContain("参与对象及人数：参加活动的同学，预计共28人。");
    expect(xml).toContain("活动计划等相关内容：午餐交流，校园参访，集体合影");
    expect(xml).not.toContain("核心体验留足自由时间");
    expect(xml).not.toContain("11:30");
    expect(xml).not.toContain("{{");
  });
});
