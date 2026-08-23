import path from "node:path";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import type { ActivityPlan } from "../shared/types.js";

export const blankExpenseFormPath = path.resolve(process.cwd(), "server/templates/北京大学学生活动经费支出明细表-空白.docx");
const runtimeTemplatePath = path.resolve(process.cwd(), "server/templates/expense-form-template.docx");

function escapeXml(value: string | number) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "活动";
}

export function formatExpenseDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return match ? `${match[1]}.${Number(match[2])}.${Number(match[3])}` : value;
}

export function formatExpenseAmount(value: number) {
  return Math.max(0, value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function sentence(value: string) {
  const text = value.trim().replace(/[。；;，,\s]+$/, "");
  return text ? `${text}。` : "通过本次活动增进参与者之间的交流与了解。";
}

function splitContent(value: string) {
  return value
    .split(/[、,，;；\n]+/)
    .map((item) => item.trim().replace(/^[\d一二三四五六七八九十]+[.、]\s*/, "").replace(/[。；;，,]+$/, ""))
    .filter((item) => item.length >= 2 && item.length <= 36);
}

function activityPlanSummary(plan: ActivityPlan) {
  const genericStep = /集合|签到|开场|说明|转场|机动|返程|收尾|复盘|提醒/;
  const specified = splitContent(plan.brief.mustHave);
  const candidates = specified.length > 0 ? specified : plan.schedule
    .filter((item) => !["集合", "转场", "机动", "收尾"].includes(item.type) && !genericStep.test(item.title))
    .map((item) => item.title);
  const items = candidates
    .map((item) => item.trim().replace(/[。；;，,]+$/, ""))
    .filter((item) => item.length >= 2 && item.length <= 36)
    .filter((item, index, all) => all.findIndex((other) => other === item || other.includes(item) || item.includes(other)) === index)
    .slice(0, 6);
  return items.length > 0 ? `${items.join("，")}等。` : "围绕活动目标开展相关体验与交流。";
}

export async function buildPrefilledExpenseForm(plan: ActivityPlan) {
  const template = await readFile(runtimeTemplatePath);
  const zip = await JSZip.loadAsync(template);
  const part = zip.file("word/document.xml");
  if (!part) throw new Error("经费表模板缺少正文");
  let xml = await part.async("string");
  const replacements: Record<string, string | number> = {
    ACTIVITY_NAME: plan.brief.title,
    ACTIVITY_TIME: formatExpenseDate(plan.brief.date),
    ACTIVITY_LOCATION: plan.brief.location || "待确认",
    ACTIVITY_PURPOSE: `活动目的及意义：${sentence(plan.brief.objective)}`,
    ACTIVITY_AUDIENCE: `参与对象及人数：参加活动的同学，预计共${plan.brief.attendees}人。`,
    ACTIVITY_PLAN: `活动计划等相关内容：${activityPlanSummary(plan)}`,
    TOTAL: formatExpenseAmount(plan.budgetItems.reduce((sum, item) => sum + Math.max(0, item.amount), 0))
  };
  for (let index = 1; index <= 10; index += 1) {
    const item = plan.budgetItems[index - 1];
    replacements[`ITEM_${index}`] = item?.item || "";
    replacements[`AMOUNT_${index}`] = item ? formatExpenseAmount(item.amount) : "";
  }
  for (const [key, value] of Object.entries(replacements)) {
    xml = xml.replaceAll(`{{${key}}}`, escapeXml(value));
  }
  if (/\{\{[A-Z0-9_]+\}\}/.test(xml)) throw new Error("经费表仍有未填写字段");
  zip.file("word/document.xml", xml, { createFolders: false });
  return {
    buffer: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
    filename: `${safeFileName(plan.brief.title)}-北京大学学生活动经费支出明细表.docx`
  };
}
