import { randomUUID } from "node:crypto";
import type {
  ActivityBrief,
  ActivityPlan,
  BudgetItem,
  MaterialItem,
  PlanMilestone,
  RiskItem,
  ScheduleItem,
  TaskItem
} from "../shared/types.js";
import { buildActivityProfile } from "./activity-profile.js";
import { retrieveCases, toReferenceInsights } from "./knowledge.js";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseDate(value: string): Date {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOffset(date: string, days: number): string {
  const value = parseDate(date);
  value.setDate(value.getDate() + days);
  return formatDate(value);
}

function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return 9 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${Math.floor(normalized / 60)}`.padStart(2, "0") + ":" + `${normalized % 60}`.padStart(2, "0");
}

function ownerFactory(members: string[]) {
  const fallbacks = ["总协调", "流程组", "后勤组", "宣传组", "现场组", "安全员"];
  return (index: number, role?: string) => members[index % Math.max(members.length, 1)] || role || fallbacks[index % fallbacks.length];
}

interface ScheduleTemplate {
  title: string;
  detail: string;
  type: ScheduleItem["type"];
  weight: number;
  ownerRole: string;
}

function analyzeBrief(brief: ActivityBrief) {
  const text = [brief.title, brief.type, brief.objective, brief.mustHave, brief.constraints, brief.location].join(" ");
  const profile = buildActivityProfile(brief);
  return {
    text,
    profile,
    isCampus: profile.isCampus,
    hasMeal: profile.hasMeal,
    isLightSocial: profile.complexity === "轻量",
    contestSignals: profile.participation === "竞赛评审",
    requiresTransport: profile.capabilities.transport === "需要",
    needsRehearsal: profile.capabilities.rehearsal === "需要",
    needsPrizes: profile.capabilities.prizes === "需要",
    needsProps: profile.capabilities.props === "需要",
    needsInsurance: profile.capabilities.insurance === "需要"
  };
}

function plannedBudget(brief: ActivityBrief) {
  const min = Math.max(0, Math.min(brief.budgetMin, brief.budgetMax));
  const max = Math.max(min, brief.budgetMax);
  if (max === 0) return 0;
  const traits = analyzeBrief(brief);
  const sensible = traits.isLightSocial ? brief.attendees * (traits.hasMeal ? 120 : 60) : Math.round((min + max) / 2);
  return clamp(Math.round(sensible), min, max);
}

function scheduleTemplate(brief: ActivityBrief): ScheduleTemplate[] {
  const traits = analyzeBrief(brief);
  if (traits.isLightSocial) {
    return [
      {
        title: "集合与简单说明",
        detail: "确认到场和临时情况，说明活动边界与后续安排，不做冗长开场。",
        type: "集合",
        weight: 0.08,
        ownerRole: "联络人"
      },
      {
        title: "核心体验与自由参与",
        detail: brief.mustHave || "围绕活动目标自由体验和交流，不额外设置比赛或强制任务。",
        type: "活动",
        weight: 0.38,
        ownerRole: "现场联络"
      },
      {
        title: traits.hasMeal ? "午餐与自由交流" : "轻松交流",
        detail: traits.hasMeal ? "提前确认餐位和忌口；用餐时自然交流，不安排主持和游戏。" : "围绕共同话题自由交流，需要时由一位联系人帮助衔接。",
        type: traits.hasMeal ? "用餐" : "活动",
        weight: 0.42,
        ownerRole: "餐饮联络"
      },
      {
        title: "合影与收尾",
        detail: "征得大家同意后合影，确认照片共享方式和遗留物品即可结束。",
        type: "收尾",
        weight: 0.12,
        ownerRole: "影像记录"
      }
    ];
  }
  const coreByType: Record<ActivityBrief["type"], [string, string]> = {
    "集体团建": traits.contestSignals ? ["自然破冰", "协作活动"] : ["共同体验", "自由交流"],
    "迎新见面": ["班级与资源介绍", "新老生交流"],
    "学术交流": ["主题分享", "圆桌与提问"],
    "晚会庆典": ["节目与互动", "仪式与合影"],
    "比赛路演": ["项目展示", "评审与答辩"],
    "志愿实践": ["任务说明与分组", "集中服务行动"],
    "其他": ["核心环节一", "核心环节二"]
  };
  const [firstCore, secondCore] = coreByType[brief.type];
  const available = Math.max(60, timeToMinutes(brief.endTime) - timeToMinutes(brief.startTime));
  const hasMeal = traits.hasMeal;

  const items: ScheduleTemplate[] = [
    {
      title: "签到与人数确认",
      detail: brief.attendees >= 60 ? "按分组签到，确认缺席、临时变更和特殊需求；现场组同步检查物资。" : "确认到场、临时变更和特殊需求；同步检查关键物资。",
      type: "集合",
      weight: 0.09,
      ownerRole: "签到组"
    },
    {
      title: "开场与规则说明",
      detail: traits.contestSignals ? "说明活动目标、时间边界、安全要求和联络方式，规则只讲一页版要点。" : "简要说明活动安排、时间边界和联络方式。",
      type: "活动",
      weight: 0.1,
      ownerRole: "主持人"
    },
    {
      title: firstCore,
      detail: brief.mustHave || "用低门槛环节让所有人进入状态，按组记录参与情况。",
      type: "活动",
      weight: hasMeal ? 0.2 : 0.25,
      ownerRole: "流程组"
    },
    {
      title: "补给与机动",
      detail: "补水、清点人员、核对下一环节物资；用于吸收迟到、转场或设备调试。",
      type: "机动",
      weight: 0.08,
      ownerRole: "后勤组"
    },
    {
      title: secondCore,
      detail: traits.contestSignals ? "围绕活动目标设置明确产出或胜负条件，负责人控时并统一规则口径。" : "围绕活动目标安排足够的自由参与时间，不额外设置竞争任务。",
      type: "活动",
      weight: hasMeal ? 0.22 : 0.3,
      ownerRole: "流程组"
    }
  ];

  if (hasMeal) {
    items.push({
      title: "集体用餐与自由交流",
      detail: "提前核对餐品数量、忌口和发放动线；用餐结束前 10 分钟提醒下一集合点。",
      type: "用餐",
      weight: 0.18,
      ownerRole: "后勤组"
    });
  }

  items.push({
    title: traits.contestSignals ? "结果公布、合影与收尾" : "合影与收尾",
    detail: traits.contestSignals ? "公布结果，完成全体合影、失物检查和物资回收，并说明后续事项。" : "完成合影、失物检查和物资回收，说明照片共享与后续事项。",
    type: "收尾",
    weight: hasMeal ? 0.13 : 0.18,
    ownerRole: "总协调"
  });

  return items;
}

function buildSchedule(brief: ActivityBrief, members: string[]): ScheduleItem[] {
  const start = timeToMinutes(brief.startTime);
  let end = timeToMinutes(brief.endTime);
  if (end <= start) end = start + 240;
  const available = end - start;
  const traits = analyzeBrief(brief);
  const total = Math.min(available, traits.profile.naturalDurationMinutes);
  const planEnd = start + total;
  const template = scheduleTemplate(brief);
  const weightTotal = template.reduce((sum, item) => sum + item.weight, 0);
  let cursor = start;

  return template.map((item, index) => {
    const isLast = index === template.length - 1;
    const raw = isLast ? planEnd - cursor : Math.round(((total * item.weight) / weightTotal) / 5) * 5;
    const duration = clamp(raw, isLast ? 10 : 15, Math.max(15, planEnd - cursor));
    const itemStart = cursor;
    cursor = Math.min(planEnd, cursor + duration);
    return {
      id: `schedule-${index + 1}`,
      time: formatTime(itemStart),
      duration: `${duration} 分钟`,
      title: item.title,
      detail: item.detail,
      owner: ownerFactory(members)(index, item.ownerRole),
      type: item.type
    };
  });
}

function allocateBudget(brief: ActivityBrief): BudgetItem[] {
  const traits = analyzeBrief(brief);
  const budget = plannedBudget(brief);
  const profile = traits.profile;
  const definitions: Array<{ category: string; item: string; note: string; weight: number }> = [
    {
      category: "场地交通", item: "场地与基础服务",
      note: profile.isCampus ? "优先使用现有校内资源，按预约要求确认" : "核对容量、时段、取消和加时规则",
      weight: profile.isCampus ? 0.06 : 0.22
    }
  ];
  if (profile.capabilities.transport === "需要") definitions.push({ category: "场地交通", item: "集体交通与转场", note: "按集合方式、里程和实际人数询价", weight: 0.18 });
  if (profile.hasMeal || profile.naturalDurationMinutes >= 270) definitions.push({ category: "餐饮", item: "餐饮、饮水与补给", note: "按确认人数、时长和忌口自下而上估算", weight: profile.hasMeal ? 0.4 : 0.14 });
  if (profile.capabilities.props !== "不需要") definitions.push({ category: "活动道具", item: "必要设备与活动物料", note: "先复用已有设备，再补采购或租赁", weight: 0.14 });
  if (profile.capabilities.prizes === "需要") definitions.push({ category: "奖品", item: "奖项与纪念品", note: "按赛制、获奖人数和发放方式估算", weight: 0.08 });
  if (profile.formality === "正式呈现" || brief.attendees >= 60) definitions.push({ category: "宣传物料", item: "导视、名牌与印刷", note: "只覆盖签到、引导和正式呈现需要", weight: 0.07 });
  if (profile.capabilities.insurance !== "不需要" || profile.isPhysical) definitions.push({ category: "安全保障", item: "保险、药品与应急保障", note: "最终金额按活动强度、地点和学校要求确认", weight: 0.08 });
  definitions.push({ category: "机动", item: "机动费用", note: "只用于人数变化和已确认必需项的偏差", weight: 0.08 });

  if (definitions.length < 2) definitions.push({ category: "其他", item: "资料与必要耗材", note: "无实际支出时可保持为 0", weight: 0.04 });
  const weightTotal = definitions.reduce((sum, item) => sum + item.weight, 0);
  let assigned = 0;
  return definitions.map((definition, index) => {
    const amount = index === definitions.length - 1
      ? Math.max(0, budget - assigned)
      : Math.round(budget * definition.weight / weightTotal);
    assigned += amount;
    return { category: definition.category, item: definition.item, amount, note: definition.note };
  });
}

function buildMaterials(brief: ActivityBrief, members: string[], budget: BudgetItem[]): MaterialItem[] {
  const owner = ownerFactory(members);
  const findBudget = (category: string) => budget.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.amount, 0);
  const deadline7 = dateOffset(brief.date, -7);
  const deadline3 = dateOffset(brief.date, -3);
  const deadline1 = dateOffset(brief.date, -1);
  const traits = analyzeBrief(brief);
  const transportNeeded = traits.requiresTransport;

  if (traits.isLightSocial) {
    const mealBudget = findBudget("餐饮");
    return [
      {
        id: "material-reservation", category: "场地交通", item: traits.isCampus ? "校内场地或餐位确认" : "场地与餐位预订",
        quantity: 1, unit: "项", estimate: findBudget("场地交通"), owner: owner(0, "活动联络"), deadline: deadline7, required: true
      },
      {
        id: "material-meal", category: "餐饮", item: traits.hasMeal ? "午餐与饮水" : "饮水与简单补给",
        quantity: brief.attendees, unit: "份", estimate: mealBudget, owner: owner(1, "餐饮联络"), deadline: deadline3, required: true
      },
      {
        id: "material-media", category: "其他", item: "手机/相机与共享相册",
        quantity: 1, unit: "套", estimate: 0, owner: owner(2, "资料记录"), deadline: deadline1, required: false
      },
      {
        id: "material-contact", category: "其他", item: "参与名单与联络方式",
        quantity: 1, unit: "份", estimate: 0, owner: owner(0, "活动联络"), deadline: deadline1, required: true
      }
    ];
  }

  const items: MaterialItem[] = [
    {
      id: "material-venue",
      category: "场地交通",
      item: "场地预订与基础服务",
      quantity: 1,
      unit: "项",
      estimate: findBudget("场地交通") - (transportNeeded ? Math.round(findBudget("场地交通") * 0.45) : 0),
      owner: owner(0, "总协调"),
      deadline: dateOffset(brief.date, -14),
      required: true
    },
    {
      id: "material-transport",
      category: "场地交通",
      item: transportNeeded ? "往返车辆与司机联络" : "校内转场与导视",
      quantity: transportNeeded ? Math.max(1, Math.ceil(brief.attendees / 45)) : 1,
      unit: transportNeeded ? "辆" : "套",
      estimate: transportNeeded ? Math.round(findBudget("场地交通") * 0.45) : 0,
      owner: owner(1, "交通联络"),
      deadline: deadline7,
      required: transportNeeded
    },
    {
      id: "material-water",
      category: "餐饮",
      item: "瓶装水",
      quantity: Math.max(brief.attendees, Math.ceil(brief.attendees * (brief.venueType === "户外" ? 2.5 : 1.5))),
      unit: "瓶",
      estimate: Math.round(Math.min(findBudget("餐饮") * 0.18, brief.attendees * 5)),
      owner: owner(2, "后勤组"),
      deadline: deadline1,
      required: true
    },
    {
      id: "material-meal",
      category: "餐饮",
      item: "正餐或简餐",
      quantity: brief.attendees,
      unit: "份",
      estimate: Math.max(0, findBudget("餐饮") - Math.round(Math.min(findBudget("餐饮") * 0.18, brief.attendees * 5))),
      owner: owner(2, "后勤组"),
      deadline: deadline3,
      required: true
    },
    {
      id: "material-badges",
      category: "宣传物料",
      item: brief.attendees >= 60 ? "分组手环、名牌与工作人员证" : "分组标识与名牌",
      quantity: brief.attendees + Math.ceil(brief.attendees * 0.05),
      unit: "套",
      estimate: Math.round(findBudget("宣传物料") * 0.45),
      owner: owner(3, "宣传组"),
      deadline: deadline3,
      required: true
    },
    {
      id: "material-signage",
      category: "宣传物料",
      item: "签到表、流程单与场地导视",
      quantity: Math.max(3, Math.ceil(brief.attendees / 25)),
      unit: "套",
      estimate: Math.round(findBudget("宣传物料") * 0.55),
      owner: owner(3, "宣传组"),
      deadline: deadline1,
      required: true
    },
    {
      id: "material-props",
      category: "活动道具",
      item: "核心活动所需道具包",
      quantity: Math.max(1, Math.ceil(brief.attendees / 12)),
      unit: "组",
      estimate: findBudget("活动道具"),
      owner: owner(4, "流程组"),
      deadline: deadline3,
      required: traits.needsProps
    },
    {
      id: "material-prizes",
      category: "奖品",
      item: "小组奖品与参与纪念",
      quantity: Math.max(3, Math.ceil(brief.attendees / 8)),
      unit: "份",
      estimate: findBudget("奖品"),
      owner: owner(4, "奖品组"),
      deadline: deadline3,
      required: traits.needsPrizes
    },
    {
      id: "material-first-aid",
      category: "安全保障",
      item: traits.needsInsurance ? "急救包、保险与紧急联络卡" : "急救包与紧急联络卡",
      quantity: Math.max(1, Math.ceil(brief.attendees / 50)),
      unit: "套",
      estimate: findBudget("安全保障"),
      owner: owner(5, "安全员"),
      deadline: deadline1,
      required: brief.venueType !== "室内" || traits.needsInsurance
    },
    {
      id: "material-media",
      category: "其他",
      item: "摄影设备与共享相册",
      quantity: 1,
      unit: "套",
      estimate: 0,
      owner: owner(5, "影像记录"),
      deadline: deadline1,
      required: false
    }
  ];
  return items.filter((item) => {
    if (item.id === "material-transport") return transportNeeded;
    if (item.id === "material-meal") return traits.hasMeal || traits.profile.naturalDurationMinutes >= 270;
    if (item.id === "material-badges") return traits.profile.capabilities.grouping !== "不需要" || traits.profile.formality === "正式呈现" || brief.attendees >= 60;
    if (item.id === "material-signage") return traits.profile.formality === "正式呈现" || brief.attendees >= 60 || traits.profile.spatialScope === "多地点流动";
    if (item.id === "material-prizes") return traits.needsPrizes;
    if (item.id === "material-props") return traits.needsProps;
    return true;
  });
}

function buildMilestones(brief: ActivityBrief, members: string[]): PlanMilestone[] {
  const owner = ownerFactory(members);
  const traits = analyzeBrief(brief);
  const milestones: PlanMilestone[] = [
    { id: "milestone-1", date: dateOffset(brief.date, -21), label: "方案与预算初稿", owner: owner(0, "总协调"), status: "待开始" },
    { id: "milestone-2", date: dateOffset(brief.date, -14), label: traits.isLightSocial ? "地点与必要资源确认" : traits.profile.capabilities.supplier === "需要" ? "场地与供应商锁定" : "场地与执行条件确认", owner: owner(1, "外联组"), status: "待开始" },
    { id: "milestone-3", date: dateOffset(brief.date, -7), label: "名单与分工确认", owner: owner(2, "组织组"), status: "待开始" },
    { id: "milestone-4", date: dateOffset(brief.date, -1), label: traits.needsRehearsal ? "彩排、装箱与二次通知" : "最终确认与行前提醒", owner: owner(3, "流程组"), status: "待开始" },
    { id: "milestone-5", date: brief.date, label: "活动执行", owner: owner(0, "总协调"), status: "待开始" },
    { id: "milestone-6", date: dateOffset(brief.date, 2), label: "报销、复盘与归档", owner: owner(4, "财务组"), status: "待开始" }
  ];
  return traits.isLightSocial ? milestones.filter((item) => item.id !== "milestone-1") : milestones;
}

function buildTasks(brief: ActivityBrief, members: string[]): TaskItem[] {
  const owner = ownerFactory(members);
  const traits = analyzeBrief(brief);
  const tasks: Array<Omit<TaskItem, "id" | "status">> = [
    { title: "确认时间与地点", description: traits.isLightSocial ? "确认集合点、场地或用餐区域是否开放，以及活动时长是否需要缩短。" : "确认活动边界、人数口径、场地容量和审批要求。", owner: owner(0, "总协调"), deadline: dateOffset(brief.date, -14), priority: "高" },
    { title: "确认出席与特殊需求", description: "收集出席情况、饮食禁忌和其他需要提前照顾的需求。", owner: owner(1, "联络人"), deadline: dateOffset(brief.date, -7), priority: "高" },
    { title: traits.hasMeal ? "预订餐位与确认菜单" : "确认必要物资", description: traits.hasMeal ? "按确认人数预订，核对忌口、价格、付款和临时增减规则。" : "只准备活动实际会用到的物品，避免照搬通用清单。", owner: owner(2, "后勤联络"), deadline: dateOffset(brief.date, -3), priority: "高", dependency: "确认出席与特殊需求" },
    { title: "发布行前提醒", description: "发出准确的集合点、联系人、结束时间和需要携带的物品。", owner: owner(1, "联络人"), deadline: dateOffset(brief.date, -1), priority: "高" },
    { title: "现场联络与记录", description: traits.isLightSocial ? "确认人员到场，落实活动边界，记录需要跟进的事项和共享资料。" : "记录到场、流程偏差、物资消耗和异常情况。", owner: owner(3, "现场联络"), deadline: brief.date, priority: "高" },
    { title: "完成报销与资料共享", description: "汇总凭证和照片，收集一轮简短反馈并归档。", owner: owner(4, "财务/记录"), deadline: dateOffset(brief.date, 2), priority: "中", dependency: "现场联络与记录" }
  ];
  if (traits.requiresTransport) tasks.splice(3, 0, { title: "确认往返交通", description: "核对乘车名单、发车点、司机联络、返程时间和临时退出方式。", owner: owner(3, "交通联络"), deadline: dateOffset(brief.date, -3), priority: "高" });
  if (brief.attendees >= 60) tasks.splice(3, 0, { title: "确认分组与现场岗位", description: "按现场区域和流程安排组长、签到、后勤与机动联系人。", owner: owner(0, "总协调"), deadline: dateOffset(brief.date, -5), priority: "高" });
  if (traits.needsRehearsal) tasks.splice(-2, 0, { title: "完成流程推演或彩排", description: "只验证转场、设备、关键口令和超时处理。", owner: owner(4, "流程组"), deadline: dateOffset(brief.date, -1), priority: "高" });
  return tasks.map((task, index) => ({ ...task, id: `task-${index + 1}`, status: "待开始", notes: "", feedback: [] }));
}

function buildRisks(brief: ActivityBrief, members: string[]): RiskItem[] {
  const owner = ownerFactory(members);
  const traits = analyzeBrief(brief);
  const risks: RiskItem[] = [];
  if (brief.venueType === "户外" || brief.venueType === "室内外结合") {
    risks.push({
      id: "risk-weather",
      level: traits.isLightSocial ? "中" : "高",
      item: "天气导致户外环节不可用",
      trigger: "活动前 24 小时预报有中雨、大风或高温预警",
      response: "提前锁定室内替代区；达到阈值即切换并在群内发布新版集合点和流程。",
      owner: owner(0, "总协调")
    });
  }
  if (brief.attendees >= 60) {
    risks.push({
      id: "risk-crowd",
      level: "高",
      item: "大规模分组与转场失序",
      trigger: "单一入口拥堵、组长无法完成点名或环节延误超过 10 分钟",
      response: "分批签到和转场；每 15—20 人设组长，另设区域负责人和机动岗。",
      owner: owner(1, "现场组")
    });
  }
  if (/动物|宠物|饲养|投喂|闪光灯|追逐/.test(traits.text)) {
    risks.push({
      id: "risk-animal",
      level: "中",
      item: "拍摄或互动影响动物",
      trigger: "出现追逐、围堵、闪光灯拍摄，或现场管理人员提出限制",
      response: "立即停止相关行为，按现场要求保持距离；不强求每个人都完成互动或照片任务。",
      owner: owner(0, "现场联络")
    });
  }
  risks.push(
    {
      id: "risk-delay",
      level: "中",
      item: "迟到或环节超时",
      trigger: "开场前 10 分钟到场率不足 85%，或单环节超时 10 分钟",
      response: traits.isLightSocial ? "群内同步集合点，先到者可自由拍摄或交流；不为等人延长全部流程。" : "保留机动时段；先执行可并行内容，删减次要环节而不压缩安全说明和返程时间。",
      owner: owner(2, "流程组")
    },
    {
      id: "risk-budget",
      level: "中",
      item: "临时加项导致超预算",
      trigger: "已确认支出接近预算上限，仍有未采购必需项",
      response: "暂停非必需支出；任何加项由总协调与财务双确认，并保留凭证。",
      owner: owner(3, "财务组")
    },
    {
      id: "risk-injury",
      level: brief.venueType === "室内" ? "中" : "高",
      item: "人员受伤或突发不适",
      trigger: "出现摔伤、持续不适或无法继续参与的情况",
      response: "立即暂停附近活动，安全员初步处理；按紧急联络卡送医并安排专人陪同和信息上报。",
      owner: owner(4, "安全员")
    },
    {
      id: "risk-food",
      level: "低",
      item: "餐品不足或忌口遗漏",
      trigger: "实到人数超过预订量，或现场发现未登记过敏/忌口",
      response: "餐食按确认人数加 5% 机动份；单独标记忌口餐并由一人负责发放。",
      owner: owner(5, "后勤组")
    }
  );
  const relevant = risks.filter((risk) => {
    if (traits.isLightSocial && risk.id === "risk-injury") return false;
    if (!traits.hasMeal && risk.id === "risk-food") return false;
    return true;
  });
  return relevant.slice(0, 5);
}

function weekday(date: string) {
  const labels = ["日", "一", "二", "三", "四", "五", "六"];
  return labels[parseDate(date).getDay()];
}

function buildNotices(brief: ActivityBrief): ActivityPlan["notices"] {
  const place = brief.location || "活动地点（确认后补充）";
  const dateText = `${brief.date}（周${weekday(brief.date)}）${brief.startTime}—${brief.endTime}`;
  const traits = analyzeBrief(brief);
  const collect = traits.hasMeal ? "请确认是否参加，并填写饮食禁忌和其他需要提前说明的情况。" : "请确认是否参加，有临时情况也可以直接说明。";
  const deadlineReason = traits.requiresTransport ? "订车、场地和餐食" : traits.hasMeal ? "预订餐位和确认人数" : "确认场地与安排";
  return {
    initial: `【${brief.title}｜出席确认】\n\n大家好，我们计划在 ${dateText} 举办${brief.type}，地点是${place}。${brief.objective ? `这次主要想做的是：${brief.objective}` : "具体安排会在人数确认后发出。"}\n\n${collect}为方便${deadlineReason}，请在 ${dateOffset(brief.date, -7)} 22:00 前完成。\n\n关键信息\n- 时间：${dateText}\n- 地点：${place}\n- 预计人数：${brief.attendees} 人\n${brief.mustHave ? `- 主要安排：${brief.mustHave}\n` : ""}\n后续会再发行前提醒，有问题直接联系活动负责人。`,
    reminder: `【${brief.title}｜行前提醒】\n\n活动就在明天，请再核对一次：\n- 集合：${brief.date} ${brief.startTime}，${place}\n- 结束：预计 ${brief.endTime}\n- 请携带：手机、充足电量和个人常用药${brief.venueType === "户外" ? "，并穿方便活动的衣服和鞋" : ""}\n- 临时迟到或无法参加，请尽早在群里说明并联系活动负责人\n\n请尽量提前 10 分钟到。${brief.constraints ? `特别提醒：${brief.constraints}` : "如有临时调整，会在群内同步。"}`,
    onsite: `【现场通知】${brief.title}开始集合。到达${place}后请向活动联系人确认到场。未到的同学请尽快在群内报位置；有身体不适或临时情况，直接联系现场负责人。`
  };
}

function buildPlanningIssues(brief: ActivityBrief) {
  const issues: string[] = [];
  if (!brief.location || /待定|确认后/.test(brief.location)) {
    issues.push("场地还没有锁定，需确认容量、动线、设备和取消规则。");
  }
  if (brief.teamMembers.length === 0) {
    issues.push("尚未录入执行成员，当前分工使用岗位名占位。");
  }
  if (!brief.constraints.trim()) {
    issues.push("未填写审批、天气、无障碍或其他限制条件。");
  }
  if (brief.budgetMax <= 0) {
    issues.push("预算尚未确定，物资金额仅能作为结构占位。");
  }
  if (brief.budgetMin > brief.budgetMax) {
    issues.push("预算下限高于上限，需要重新确认预算范围。");
  }
  if (brief.attendees >= 60) {
    issues.push("人数较多，需在活动前补齐分组表、区域负责人和机动岗。");
  }
  if (brief.venueType === "户外" || brief.venueType === "室内外结合") {
    issues.push("户外环节需在活动前 24 小时按天气阈值做最终决策。");
  }
  const traits = analyzeBrief(brief);
  const available = timeToMinutes(brief.endTime) - timeToMinutes(brief.startTime);
  if (traits.profile.naturalDurationMinutes < available - 30) {
    issues.push(`按当前目标，核心流程约需 ${traits.profile.naturalDurationMinutes} 分钟；请确认是否缩短活动时段，或另有尚未填写的目标。`);
  }
  return issues;
}

export function generateLocalPlan(brief: ActivityBrief): ActivityPlan {
  const cases = retrieveCases(brief);
  const budgetItems = allocateBudget(brief);
  const traits = analyzeBrief(brief);
  const historicalTips = traits.isLightSocial
    ? ["核心体验留足自由时间", "只保留必要岗位", "结束后完成资料归档"]
    : cases.flatMap((item) => item.reusableTips).slice(0, 3);
  return {
    id: randomUUID(),
    generatedBy: "rules",
    generatedAt: new Date().toISOString(),
    brief,
    theme: brief.title,
    summary: `围绕“${brief.objective || "让参与者自然交流"}”安排必要环节。方案按 ${brief.attendees} 人、预算 ${brief.budgetMin.toLocaleString("zh-CN")}—${brief.budgetMax.toLocaleString("zh-CN")} 元考虑，不为填满时间额外增加无关活动。`,
    goals: [
      brief.objective || "让参与者在自然互动中建立联系",
      brief.attendees >= 60 ? `让 ${brief.attendees} 人在清晰联络和分组下完成主要环节` : `让 ${brief.attendees} 人能自然参与，不被复杂规则打断`,
      `将建议支出控制在 ${brief.budgetMin.toLocaleString("zh-CN")}—${brief.budgetMax.toLocaleString("zh-CN")} 元范围内`
    ],
    highlights: historicalTips.length > 0 ? historicalTips : ["一页式流程", "清晰岗位", "现场可调整"],
    decisions: traits.profile.decisions,
    milestones: buildMilestones(brief, brief.teamMembers),
    schedule: buildSchedule(brief, brief.teamMembers),
    tasks: buildTasks(brief, brief.teamMembers),
    materials: buildMaterials(brief, brief.teamMembers, budgetItems),
    budgetItems,
    notices: buildNotices(brief),
    risks: buildRisks(brief, brief.teamMembers),
    references: toReferenceInsights(cases, brief),
    planningIssues: buildPlanningIssues(brief)
  };
}

export function refineLocalPlan(plan: ActivityPlan, instruction: string): ActivityPlan {
  const brief = { ...plan.brief, teamMembers: [...plan.brief.teamMembers] };
  const people = instruction.match(/(?:改为|调整为|按)?\s*(\d{1,4})\s*人/);
  const budgetRange = instruction.match(/预算[^\d]*(\d+(?:\.\d+)?)\s*(?:元|块)?\s*(?:到|至|—|-|~)\s*[¥￥]?\s*(\d+(?:\.\d+)?)\s*(?:元|块)?/);
  const budget = instruction.match(/预算(?:改为|调整为|控制在|降到|提高到)?\s*[¥￥]?\s*(\d+(?:\.\d+)?)\s*(?:元|块)?/);
  const date = instruction.match(/(?:日期|时间|改到|调整到)[^\d]*(\d{4}-\d{1,2}-\d{1,2})/);
  const place = instruction.match(/(?:地点|场地)(?:改为|调整为|换到|换成)?[：:\s]*([^，。；;\n]+)/);

  if (people) brief.attendees = clamp(Number(people[1]), 1, 5000);
  if (budgetRange) {
    brief.budgetMin = Math.max(0, Number(budgetRange[1]));
    brief.budgetMax = Math.max(brief.budgetMin, Number(budgetRange[2]));
  } else if (budget) {
    brief.budgetMax = Math.max(0, Number(budget[1]));
    brief.budgetMin = Math.min(brief.budgetMin, brief.budgetMax);
  }
  if (date) {
    const [year, month, day] = date[1].split("-").map(Number);
    brief.date = `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
  }
  if (place) brief.location = place[1].trim();

  const next = generateLocalPlan(brief);
  const extra = instruction.match(/(?:增加|加入|补充)(.+?)(?:环节|活动)?(?:[。；;]|$)/);
  if (extra && !people && !budget && !budgetRange && !date && !place) {
    const addition = extra[1].trim();
    next.highlights = [`新增：${addition}`, ...next.highlights].slice(0, 4);
    next.schedule.splice(Math.max(2, next.schedule.length - 1), 0, {
      id: `schedule-added-${Date.now()}`,
      time: "待排",
      duration: "按现场流程调整",
      title: addition,
      detail: `根据调整指令新增“${addition}”，需要确认准确时长、必要物资和负责人。`,
      owner: brief.teamMembers[0] || "流程组",
      type: "活动"
    });
  }
  next.id = plan.id;
  next.feedbackHistory = [...(plan.feedbackHistory || []), { id: randomUUID(), instruction, createdAt: new Date().toISOString() }];
  return next;
}
