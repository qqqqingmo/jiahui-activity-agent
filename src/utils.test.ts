import { describe, expect, it } from "vitest";
import type { PlanMilestone, TaskItem } from "../shared/types";
import { syncMilestoneOwners, taskExecutionProgress } from "./utils";

function task(id: string, priority: TaskItem["priority"], status: TaskItem["status"]): TaskItem {
  return { id, title: id, description: "", owner: "", deadline: "2026-09-01", priority, status };
}

describe("执行进度", () => {
  it("全部未开始时是 0", () => {
    expect(taskExecutionProgress([task("a", "高", "待开始"), task("b", "低", "待开始")])).toBe(0);
  });

  it("按任务优先级加权，进行中计一半", () => {
    const tasks = [task("高", "高", "进行中"), task("低", "低", "已完成")];
    expect(taskExecutionProgress(tasks)).toBe(63);
  });
});

describe("任务负责人同步", () => {
  const milestones: PlanMilestone[] = [
    { id: "m1", date: "2026-08-20", label: "名单与分工确认", owner: "组织组", status: "待开始" },
    { id: "m2", date: "2026-08-26", label: "最终确认与行前提醒", owner: "联络人", status: "待开始" }
  ];

  it("优先按任务截止日期同步对应里程碑", () => {
    const previous = { ...task("attendance", "高", "待开始"), title: "确认出席与特殊需求", owner: "组织组", deadline: "2026-08-20" };
    const next = { ...previous, owner: "林同学" };
    const result = syncMilestoneOwners(milestones, previous, next);
    expect(result[0].owner).toBe("林同学");
    expect(result[1].owner).toBe("联络人");
  });

  it("日期没有对应项时按任务语义同步", () => {
    const previous = { ...task("reminder", "高", "待开始"), title: "发布行前提醒", owner: "联络人", deadline: "2026-08-25" };
    const result = syncMilestoneOwners(milestones, previous, { ...previous, owner: "周同学" });
    expect(result[1].owner).toBe("周同学");
  });
});
