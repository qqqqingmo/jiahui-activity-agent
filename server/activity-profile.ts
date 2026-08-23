import type { ActivityBrief, PlanningDecision } from "../shared/types.js";

export type NeedLevel = "需要" | "可选" | "不需要";

export interface ActivityProfile {
  complexity: "轻量" | "标准" | "复杂";
  formality: "轻松交流" | "组织活动" | "正式呈现";
  spatialScope: "单点校内" | "单点校外" | "多地点流动" | "地点待确认";
  participation: "自由参与" | "共同体验" | "分组协作" | "竞赛评审" | "舞台呈现";
  hasMeal: boolean;
  isCampus: boolean;
  isPhysical: boolean;
  naturalDurationMinutes: number;
  capabilities: {
    transport: NeedLevel;
    grouping: NeedLevel;
    host: NeedLevel;
    rehearsal: NeedLevel;
    technicalCheck: NeedLevel;
    prizes: NeedLevel;
    insurance: NeedLevel;
    supplier: NeedLevel;
    props: NeedLevel;
  };
  decisions: PlanningDecision[];
}

function timeToMinutes(time: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

export function buildActivityProfile(brief: ActivityBrief): ActivityProfile {
  const text = [brief.title, brief.type, brief.objective, brief.mustHave, brief.constraints, brief.location, brief.venueType, ...brief.teamMembers].join(" ");
  const campusPositive = /校内|校园|学院|教学楼|报告厅|礼堂|操场|北京大学|北大/.test(text);
  const campusNegative = /校外|近郊|郊区|跨校|外地|景区|营地|园区/.test(text);
  const isCampus = campusPositive && !campusNegative;
  const multiLocation = /多地点|多场地|转场|分会场|往返|路线|行程|串联/.test(text);
  const locationPending = !brief.location.trim() || /待定|未定|确认后/.test(brief.location);
  const spatialScope: ActivityProfile["spatialScope"] = locationPending
    ? "地点待确认"
    : multiLocation ? "多地点流动" : isCampus ? "单点校内" : "单点校外";

  const hasMeal = /午餐|晚餐|聚餐|共进|用餐|餐叙|餐会|茶歇|餐饮/.test(text);
  const contest = /比赛|竞赛|挑战|对抗|闯关|定向|计分|评审|答辩|投票|颁奖/.test(text) || brief.type === "比赛路演";
  const performance = /晚会|典礼|舞台|节目|路演|直播|灯光|音响|主持词/.test(text) || brief.type === "晚会庆典";
  const formal = performance || /大会|论坛|嘉宾|仪式|领导|主旨报告|发布会/.test(text);
  const relaxed = /自由交流|认识彼此|熟悉彼此|聚餐|餐叙|参观|参访|拍照|摄影|散步|体验|茶话|沙龙|见面/.test(text);
  const groupWork = contest || /分组|小组|协作|团队任务|志愿岗位|轮换/.test(text);
  const isPhysical = /登山|徒步|滑雪|体育|运动|拓展|骑行|游泳|攀岩|水上|高空/.test(text);
  const explicitTransport = /大巴|包车|车辆|司机|乘车|交通接驳|发车/.test(text);
  const technicalDependency = /投影|麦克风|屏幕|音响|灯光|直播|播放|中控|设备/.test(text);
  const explicitHost = /主持|司仪/.test(text);
  const outsourced = /供应商|外包|商家|场地方|教练|承办方|报价|套餐/.test(text);
  const explicitRehearsal = /彩排|联排|走台|流程推演|设备联调/.test(text);
  const explicitPrizes = /奖品|奖状|奖金|纪念品|颁奖/.test(text);
  const windowMinutes = Math.max(60, timeToMinutes(brief.endTime) - timeToMinutes(brief.startTime));

  const formality: ActivityProfile["formality"] = formal ? "正式呈现" : relaxed && !contest ? "轻松交流" : "组织活动";
  const participation: ActivityProfile["participation"] = performance
    ? "舞台呈现"
    : contest ? "竞赛评审" : groupWork ? "分组协作" : relaxed ? "自由参与" : "共同体验";
  const complexity: ActivityProfile["complexity"] = formal || brief.attendees >= 120 || (multiLocation && brief.attendees >= 60)
    ? "复杂"
    : (relaxed && !contest && brief.attendees <= 60 && !isPhysical) ? "轻量" : "标准";

  const transport: NeedLevel = explicitTransport || (spatialScope === "多地点流动" && !isCampus)
    ? "需要" : spatialScope === "单点校外" ? "可选" : "不需要";
  const grouping: NeedLevel = groupWork ? "需要" : brief.attendees >= 100 ? "可选" : "不需要";
  const host: NeedLevel = explicitHost || formal || performance ? "需要" : brief.attendees >= 80 ? "可选" : "不需要";
  const technicalCheck: NeedLevel = technicalDependency ? "需要" : formal ? "可选" : "不需要";
  const rehearsal: NeedLevel = explicitRehearsal || (performance && (brief.attendees >= 40 || technicalDependency))
    ? "需要" : formal && technicalDependency ? "可选" : "不需要";
  const prizes: NeedLevel = explicitPrizes || contest ? "需要" : "不需要";
  const insurance: NeedLevel = isPhysical && !isCampus ? "需要" : isPhysical || (brief.venueType !== "室内" && !isCampus) ? "可选" : "不需要";
  const supplier: NeedLevel = outsourced ? "需要" : (brief.attendees >= 100 || (brief.venueType === "户外" && !isCampus)) ? "可选" : "不需要";
  const props: NeedLevel = contest || performance || /游戏|手作|道具|展板|签到墙|布展/.test(text) ? "需要" : technicalDependency ? "可选" : "不需要";

  const naturalDurationMinutes = Math.min(windowMinutes,
    complexity === "轻量" ? (hasMeal ? 210 : 150) : complexity === "标准" ? (hasMeal ? 300 : 240) : windowMinutes);

  const decisions: PlanningDecision[] = [
    {
      dimension: "组织复杂度",
      decision: `${complexity} · ${participation}`,
      reason: complexity === "轻量"
        ? explicitHost ? "目标集中、规模适中，只保留简报中已经明确的主持或设备职责，不再增加复杂岗位。" : "目标集中、规模适中，不用额外增加竞赛、主持或强制分组。"
        : complexity === "复杂" ? "规模、正式程度或场地流动要求更清晰的岗位与控制点。" : "需要基本执行结构，但不采用大型活动的全套配置。"
    },
    {
      dimension: "交通安排",
      decision: transport,
      reason: transport === "需要" ? "地点和移动方式已构成集体转场需求。" : transport === "可选" ? "活动在校外单点，先确认集合方式和参与者自行到达条件，再决定是否统一交通。" : "活动在校内单点或没有集体移动证据，不默认安排车辆。"
    },
    {
      dimension: "现场组织",
      decision: [grouping !== "不需要" ? `分组${grouping}` : "不分组", host !== "不需要" ? `主持${host}` : "不设主持"].join(" · "),
      reason: groupWork || formal || explicitHost ? "活动目标、正式程度或已填写岗位需要明确的组织口径。" : "以自然参与为主，只保留一名现场联络人。"
    },
    {
      dimension: "演练与设备",
      decision: rehearsal === "需要" ? "安排关键环节演练" : technicalCheck === "需要" ? "只做设备检查" : "不安排彩排",
      reason: rehearsal === "需要" ? "存在舞台呈现、多人衔接或明确彩排要求。" : technicalCheck === "需要" ? "流程不需彩排，但设备是活动完成的前置条件。" : "没有舞台、复杂转场或关键设备依赖。"
    },
    {
      dimension: "时间密度",
      decision: naturalDurationMinutes < windowMinutes - 30 ? `核心流程约 ${naturalDurationMinutes} 分钟` : `按 ${windowMinutes} 分钟窗口编排`,
      reason: naturalDurationMinutes < windowMinutes - 30 ? "目标所需时长短于预留窗口，不用无关环节填满时间。" : "当前目标与流程足以合理使用所给时段。"
    },
    {
      dimension: "保障投入",
      decision: insurance === "需要" ? "配置专项安全与保险" : insurance === "可选" ? "活动前确认保险必要性" : "常规应急即可",
      reason: insurance === "需要" ? "活动强度和校外条件构成明确的人身风险。" : insurance === "可选" ? "需结合最终地点、强度和学校要求确认。" : "当前没有高强度或特殊风险证据。"
    }
  ];

  return {
    complexity, formality, spatialScope, participation, hasMeal, isCampus, isPhysical, naturalDurationMinutes,
    capabilities: { transport, grouping, host, rehearsal, technicalCheck, prizes, insurance, supplier, props },
    decisions
  };
}

export function compactProfileForModel(profile: ActivityProfile) {
  return {
    complexity: profile.complexity,
    formality: profile.formality,
    spatialScope: profile.spatialScope,
    participation: profile.participation,
    naturalDurationMinutes: profile.naturalDurationMinutes,
    capabilityDraft: profile.capabilities,
    note: "这是规则层的初步判断。模型应结合完整简报独立复核，有充分理由时可以修改。"
  };
}
