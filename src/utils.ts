import type { ActivityPlan, PlanMilestone, TaskItem } from "../shared/types";

export function currency(value: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);
}

export function displayDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", weekday: "short" }).format(value);
}

export function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86_400_000);
}

export function taskExecutionProgress(tasks: TaskItem[]) {
  const priorityWeight = { 高: 3, 中: 2, 低: 1 } as const;
  const statusRatio = { 待开始: 0, 进行中: 0.5, 已完成: 1 } as const;
  const totalWeight = tasks.reduce((sum, task) => sum + priorityWeight[task.priority], 0);
  if (totalWeight === 0) return 0;
  const earned = tasks.reduce((sum, task) => sum + priorityWeight[task.priority] * statusRatio[task.status], 0);
  return Math.round(earned / totalWeight * 100);
}

const milestoneTaskPatterns = [
  { task: /方案|策划|预算|审批|立项/, milestone: /方案|预算|审批|立项/ },
  { task: /时间|地点|场地|供应商|资源|执行条件/, milestone: /地点|场地|供应商|资源|执行条件/ },
  { task: /出席|名单|分工|岗位|特殊需求|分组/, milestone: /名单|分工|岗位/ },
  { task: /行前|提醒|彩排|推演|装箱|交通|往返|菜单|预订|物资/, milestone: /最终|行前|彩排|装箱|二次通知/ },
  { task: /现场|活动执行|签到|联络|记录/, milestone: /活动执行/ },
  { task: /报销|复盘|归档|资料共享|凭证/, milestone: /报销|复盘|归档/ }
];

export function syncMilestoneOwners(milestones: PlanMilestone[], previous: TaskItem, next: TaskItem) {
  if (!next.owner.trim() || previous.owner === next.owner) return milestones;
  const exactDate = milestones.filter((item) => item.date === next.deadline || item.date === previous.deadline);
  let targets = exactDate.length === 1 ? exactDate : [];
  if (targets.length === 0) {
    const titles = `${previous.title} ${next.title}`;
    const match = milestoneTaskPatterns.find((item) => item.task.test(titles));
    if (match) targets = milestones.filter((item) => match.milestone.test(item.label));
  }
  if (targets.length === 0) return milestones;
  const ids = new Set(targets.map((item) => item.id));
  return milestones.map((item) => ids.has(item.id) ? { ...item, owner: next.owner.trim() } : item);
}

export function planToMarkdown(plan: ActivityPlan) {
  const total = plan.budgetItems.reduce((sum, item) => sum + item.amount, 0);
  return `# ${plan.theme}

> ${plan.summary}

## 基本信息

- 日期：${plan.brief.date} ${plan.brief.startTime}—${plan.brief.endTime}
- 地点：${plan.brief.location || "待确认"}
- 人数：${plan.brief.attendees} 人
- 预算范围：${currency(plan.brief.budgetMin)}—${currency(plan.brief.budgetMax)}
- 建议支出：${currency(total)}
- 方案来源：${plan.generatedBy === "model" ? "智能规划" : "基础草案"}

## 活动目标

${plan.goals.map((item) => `- ${item}`).join("\n")}

## 关键判断

${plan.decisions.map((item) => `- **${item.dimension}｜${item.decision}**：${item.reason}`).join("\n")}

## 现场流程

| 时间 | 时长 | 环节 | 执行说明 | 负责人 |
| --- | --- | --- | --- | --- |
${plan.schedule.map((item) => `| ${item.time} | ${item.duration} | ${item.title} | ${item.detail} | ${item.owner} |`).join("\n")}

## 倒排任务

${plan.tasks.map((item) => `- [${item.status === "已完成" ? "x" : " "}] **${item.title}**（${item.deadline} / ${item.owner} / ${item.priority} / ${item.status}）  \n  ${item.description}${item.notes ? `  \n  备注：${item.notes}` : ""}${item.feedback?.length ? `  \n  最新反馈：${item.feedback[item.feedback.length - 1].author}：${item.feedback[item.feedback.length - 1].content}` : ""}`).join("\n")}

## 物资清单

| 类别 | 物资 | 数量 | 估算 | 负责人 | 截止 |
| --- | --- | ---: | ---: | --- | --- |
${plan.materials.map((item) => `| ${item.category} | ${item.item} | ${item.quantity}${item.unit} | ${currency(item.estimate)} | ${item.owner} | ${item.deadline} |`).join("\n")}

## 预算

${plan.budgetItems.map((item) => `- ${item.item}：${currency(item.amount)}（${item.note}）`).join("\n")}

**合计：${currency(total)}**

## 风险与处理

${plan.risks.map((item) => `### ${item.level}｜${item.item}\n\n- 触发：${item.trigger}\n- 处理：${item.response}\n- 负责人：${item.owner}`).join("\n\n")}

## 班群通知

### 首次通知

${plan.notices.initial}

### 行前提醒

${plan.notices.reminder}

### 现场通知

${plan.notices.onsite}

## 参考的过往经验

${plan.references.map((item) => `- **${item.title}**：${item.reason} ${item.evidence}`).join("\n")}
`;
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyText(content: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch {
      // 浏览器可能禁用剪贴板权限，继续使用兼容方案。
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}
