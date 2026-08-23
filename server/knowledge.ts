import type { ActivityBrief, KnowledgeCase, ReferenceInsight } from "../shared/types.js";
import { buildActivityProfile } from "./activity-profile.js";

export const knowledgeCases: KnowledgeCase[] = [
  {
    id: "tongclass-2023-autumn",
    title: "2023 秋季通班团建",
    year: 2023,
    activityType: "集体团建",
    scale: 42,
    budget: 15900,
    venueType: "室内外结合",
    sourceFiles: [
      "班级团建/2023秋团建/2023秋通班团建活动.docx",
      "班级团建/2023秋团建/北京大学学生活动经费支出明细表 通班团建.docx"
    ],
    tags: ["团建", "破冰", "定向", "游戏", "读书会", "班级文化", "交通", "摄影", "40人"],
    summary: "将体力活动、班级文化和学术交流放在同一场团建中，面向约 42 人安排室内外活动。",
    evidence: [
      "经费共 15,900 元，其中场地服务 10,800 元、往返车费 1,800 元、餐饮 2,250 元、奖品 1,000 元。",
      "物资明确到每人 2—3 瓶水，并单列拍照摄像和校外往返交通。",
      "活动同时包含破冰、分组游戏、共绘蓝图和读书分享，兼顾熟悉彼此与班级特色。"
    ],
    reusableTips: [
      "一场团建最好同时设置低门槛破冰、核心协作和集体留念三个层次。",
      "校外活动要把交通、饮水、摄影写进执行清单，不能只写游戏规则。",
      "把班级共同经历或专业梗放进题库，参与感通常比通用题库更好。"
    ],
    pitfalls: ["方案选项很多，但如果不提前锁定主线和时长，现场容易临时删改。"]
  },
  {
    id: "tongclass-2024-sports",
    title: "2024 夏季体育拓展团建",
    year: 2024,
    activityType: "集体团建",
    scale: 40,
    budget: 15720,
    venueType: "室内外结合",
    sourceFiles: [
      "班级团建/2024夏团建/班委会会议纪要.docx",
      "班级团建/2024夏团建/北京大学学生活动经费支出明细表 通班团建.docx"
    ],
    tags: ["团建", "体育", "供应商", "砍价", "预算", "午餐", "大巴", "文创", "40人"],
    summary: "班委会先比较方案，再围绕活动、交通、餐饮和奖品拆出人均预算，与商家确认容量和时长。",
    evidence: [
      "班委会按人均约 500 元预分：活动不超过 300、交通 50、奖品 50、餐饮 100。",
      "执行前需要向商家确认 40 人容量、活动时长、自由活动时间并议价。",
      "最终支出 15,720 元，活动门票与体育费占最大项，另含往返车、桌餐、奖品和教练服务。"
    ],
    reusableTips: [
      "先给每个预算大类设人均上限，再去询价，能更快判断方案是否可行。",
      "供应商确认清单至少包括容量、时长、发车点、自由活动空间、取消与改期规则。",
      "午餐地点要与集合和发车动线一起决定。"
    ],
    pitfalls: ["只看套餐单价容易漏掉教练、加时、运输和二次消费。"]
  },
  {
    id: "tongclass-2024-hongluo",
    title: "2024 秋季红螺寺户外实践",
    year: 2024,
    activityType: "集体团建",
    scale: 35,
    budget: 7241.38,
    venueType: "户外",
    sourceFiles: [
      "班级团建/2024秋团建/红螺寺-行程规划.docx",
      "班级团建/2024秋团建/北京大学学生活动经费支出明细表 红螺寺.docx"
    ],
    tags: ["户外", "登山", "定向", "路线", "分组", "集合点", "保险", "午餐", "天气", "35人"],
    summary: "约 35 人分四组走不同上山路线，在统一集合点汇合，并设计错峰下山与路线互换。",
    evidence: [
      "四条路线分别标记打卡点，统一在中天门汇合后再登顶。",
      "下山区分滑道和步行人群，并按上山路线反向分流，降低拥堵和走失风险。",
      "预算中单列保险 806.33 元、交通 1,600 元、打包午餐与水 1,892.05 元。"
    ],
    reusableTips: [
      "户外分组要写清每组路线、组长、汇合点、最晚到达时间和失联处理。",
      "门票之外要单列保险、打包餐饮和紧急交通。",
      "上下山或进出场采用不同动线，能减少拥堵并提升体验。"
    ],
    pitfalls: ["路线写得很细，但天气阈值和替代方案也应在活动前明确。"]
  },
  {
    id: "iai-2024-tech-day",
    title: "2024 学生大会暨科技节",
    year: 2024,
    activityType: "学术交流",
    scale: 200,
    venueType: "室内外结合",
    sourceFiles: [
      "科技节/2024科技节/2024年 —— 人工智能研究院2024年度学生大会暨科技节筹备表.xlsx",
      "科技节/2024科技节/志愿者分工表.xlsx"
    ],
    tags: ["科技节", "学术", "大会", "嘉宾", "志愿者", "物料", "投票", "颁奖", "彩排", "大型活动"],
    summary: "筹备表把议程、To Do、里程碑、现场布景、岗位、奖品与预算拆到不同工作表，适合大型活动协同。",
    evidence: [
      "任务按流程、现场、宣发、奖品、后勤、手续和评审拆组，并明确中控、物料、引导、机动等现场岗位。",
      "时间线包含议程确认、场勘、奖状制作、主持词、评审、彩排和设备调试等截止点。",
      "物料表记录名称、规格、数量和摆放区域；现场讨论中特别追问投票统计、屏幕控制和雨天备案。"
    ],
    reusableTips: [
      "大型活动必须设置中控、区域负责人和机动岗，不能只按部门分工。",
      "物料清单要带规格、数量、摆放点、到货时间和验收人。",
      "正式议程之外，单独维护一张倒排时间表和一次全流程彩排。"
    ],
    pitfalls: ["雨天预案曾被列为待确认项；室外布展必须提前设置迁移阈值和室内落位。"]
  },
  {
    id: "tongclass-2024-joint-assembly",
    title: "2024 清北通班联动大会",
    year: 2024,
    activityType: "学术交流",
    scale: 180,
    venueType: "室内外结合",
    sourceFiles: [
      "院级团建活动/2024北清通班大联会/第二届会议议程.pdf",
      "院级团建活动/2024北清通班大联会/通班年会主持/清北通班联谊大会主持词0323-v3.docx"
    ],
    tags: ["联动", "大会", "嘉宾", "主持", "茶歇", "合影", "晚餐", "转场", "180人"],
    summary: "面向多校、多年级和嘉宾的半日大会，包含报告、分享、授旗、合影、茶歇、互动和晚餐。",
    evidence: [
      "主持稿在合影、茶歇、下半场落座和晚餐转场处都有明确口播。",
      "议程将正式报告与趣味知识竞赛、乐队表演结合，维持长时活动节奏。",
      "嘉宾介绍、上台顺序、合影站位与餐叙去向都需要提前核对。"
    ],
    reusableTips: [
      "有嘉宾的活动应为每个上台、合影和转场准备一句可直接执行的主持提示。",
      "长议程中穿插休息与互动，并给重新落座留出缓冲。",
      "对跨组织活动，提前设置单一联络窗口和最终版名单。"
    ],
    pitfalls: ["嘉宾姓名、头衔和临时缺席属于高风险信息，必须在开场前二次核对。"]
  },
  {
    id: "iai-2026-winter",
    title: "2026 通班与博士生冬季团建",
    year: 2026,
    activityType: "集体团建",
    scale: 96,
    venueType: "室内外结合",
    sourceFiles: [
      "院级团建活动/2026通班&博士生滑雪团建/1.11团建上午游戏预案.docx",
      "院级团建活动/2026通班&博士生滑雪团建/应急处理预案.docx"
    ],
    tags: ["大型团建", "滑雪", "分组", "裁判", "手机定位", "网络", "安全", "应急", "缓冲", "96人"],
    summary: "8 组轮换两项游戏，用统一裁判记录得分，并在 90 分钟流程中保留 10 分钟机动。",
    evidence: [
      "集合阶段逐组清点人数，并检查手机电量、网络、场地边界和禁止区域。",
      "两轮游戏由裁判统一计时和记分，提前结束的小组原地休整，避免换场混乱。",
      "应急材料涉及现场医务室、转诊、陪同人员和基础医疗用品。"
    ],
    reusableTips: [
      "轮换赛制要统一口径、记录表和换场时间，结束早也不要提前串场。",
      "依赖定位或小程序时，把电量、网络和备用方案列为开场检查项。",
      "提前指定送医路线、车辆/急救电话、陪同人与校内联络人。"
    ],
    pitfalls: ["应急方案里仍有问号事项，说明责任人与费用边界应在活动前完成确认。"]
  },
  {
    id: "iai-2026-spring",
    title: "2026 春季主题团建",
    year: 2026,
    activityType: "集体团建",
    scale: 100,
    venueType: "户外",
    sourceFiles: [
      "院级团建活动/2026春季团建/策划方案.docx",
      "院级团建活动/2026春季团建/“循环食物链”撕名牌方案.docx"
    ],
    tags: ["大型团建", "户外", "撕名牌", "晚会", "供应商", "预算质询", "安全区", "裁判", "100人"],
    summary: "白天分组竞技、自由活动与晚间节目结合，并对供应商报价逐项质询、自主承接部分策划。",
    evidence: [
      "主活动把 100 人分为 6 组，明确安全区、资源投放、复活、裁判和积分规则。",
      "预算质询逐项识别重复领队、过量副教练、道具运输和篝火组织等可压缩费用。",
      "晚会物资具体到蛋糕、香槟、篝火零食、全程录像和合影。"
    ],
    reusableTips: [
      "复杂游戏要同时输出玩家规则、裁判记录表、广播口令和安全边界。",
      "供应商报价逐行比较‘必须外包’与‘学生可自办’，有助于控制预算。",
      "全天活动要在高强度环节之间安排休息、自由活动和补给。"
    ],
    pitfalls: ["规则越复杂，现场讲解越容易失真；应制作一页版规则和裁判速查表。"]
  },
  {
    id: "tongclass-welcome-culture",
    title: "通班迎新与集体文化活动",
    year: 2025,
    activityType: "迎新见面",
    scale: 45,
    venueType: "室内",
    sourceFiles: [
      "通班发展回顾&迎新/25.8.28 - 新生见面会.pptx",
      "科技节/2023科技节/手卡 - 上午.docx"
    ],
    tags: ["迎新", "见面会", "班级介绍", "仪式", "合影", "吉祥物", "新生", "文化"],
    summary: "用教学、科研、交流、支持和组织五个板块介绍班级，并通过徽章、吉祥物与合影强化身份感。",
    evidence: [
      "新生见面会内容从教学、科研实践、交流、支持和组织展开，而不是只介绍规章。",
      "过往开班仪式包含徽章/书签、老师寄语、队形调整和集体合影。",
      "吉祥物与表情包作为轻量互动内容，能降低正式介绍的距离感。"
    ],
    reusableTips: [
      "迎新信息按‘能学到什么、能得到什么支持、怎样参与’组织，更贴近新生视角。",
      "安排一个简单但可留存的身份仪式和一次全体合影。",
      "正式介绍之间穿插学长学姐经验或班级文化互动。"
    ],
    pitfalls: ["介绍信息密度过大时，新生难以记住；会后应配一条资源汇总通知。"]
  }
];

const typeTerms: Record<string, string[]> = {
  "集体团建": ["团建", "破冰", "游戏", "凝聚力", "交流"],
  "迎新见面": ["迎新", "新生", "见面会", "班级介绍"],
  "学术交流": ["学术", "大会", "科技节", "分享", "嘉宾"],
  "晚会庆典": ["晚会", "表演", "庆典", "节目", "抽奖"],
  "比赛路演": ["比赛", "路演", "答辩", "评审", "投票"],
  "志愿实践": ["志愿", "实践", "公益", "服务"],
  "其他": []
};

function buildSearchText(brief: ActivityBrief): string {
  return [
    brief.title,
    brief.type,
    brief.objective,
    brief.location,
    brief.venueType,
    brief.mustHave,
    brief.constraints,
    ...(typeTerms[brief.type] ?? [])
  ]
    .join(" ")
    .toLowerCase();
}

export function retrieveCases(brief: ActivityBrief, limit = 3, pool: KnowledgeCase[] = knowledgeCases): Array<KnowledgeCase & { score: number }> {
  const text = buildSearchText(brief);
  const profile = buildActivityProfile(brief);
  return pool
    .map((item) => {
      let score = 0;
      if (item.activityType === brief.type) score += 7;
      if (item.venueType === brief.venueType) score += 3;
      if (item.venueType === "室内外结合" && brief.venueType !== "待定") score += 1;
      for (const tag of item.tags) {
        if (text.includes(tag.toLowerCase())) score += 2;
      }
      const caseCompetitive = item.tags.some((tag) => /比赛|定向|对抗|计分|裁判/.test(tag));
      const casePhysical = item.tags.some((tag) => /登山|体育|滑雪|徒步|户外拓展/.test(tag));
      const caseFormal = item.tags.some((tag) => /大会|嘉宾|主持|颁奖|彩排|大型活动/.test(tag));
      if (profile.participation !== "竞赛评审" && caseCompetitive) score -= profile.formality === "轻松交流" ? 12 : 7;
      if (!profile.isPhysical && casePhysical) score -= profile.formality === "轻松交流" ? 12 : 5;
      if (profile.formality !== "正式呈现" && caseFormal) score -= 4;
      if (profile.formality === "轻松交流" && item.tags.some((tag) => /交流|见面会|摄影|合影|午餐/.test(tag))) score += 4;
      const scaleGap = Math.abs(item.scale - brief.attendees) / Math.max(brief.attendees, 1);
      score += Math.max(0, 4 - scaleGap * 4);
      if (item.budget && item.scale > 0 && brief.budgetMax > 0) {
        const targetBudget = (brief.budgetMin + brief.budgetMax) / 2;
        const perPersonGap = Math.abs(item.budget / item.scale - targetBudget / brief.attendees);
        score += Math.max(0, 2 - perPersonGap / 200);
      }
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function toReferenceInsights(
  cases: Array<KnowledgeCase & { score: number }>,
  brief: ActivityBrief
): ReferenceInsight[] {
  const profile = buildActivityProfile(brief);
  return cases.map((item) => {
    const scaleText = Math.abs(item.scale - brief.attendees) <= Math.max(10, brief.attendees * 0.25)
      ? `规模接近（${item.scale} 人）`
      : `可借鉴其 ${item.activityType} 做法`;
    const matchingEvidence = [...item.evidence, ...item.reusableTips].find((evidence) => {
      if (profile.formality === "轻松交流") return /交流|摄影|拍照|合影|午餐|见面|低门槛/.test(evidence) && !/比赛|计分|奖品|登山|路线|大巴|车辆|交通|发车|保险|主持|彩排/.test(evidence);
      if (profile.participation === "竞赛评审") return /规则|评审|计分|裁判|投票/.test(evidence);
      if (profile.isPhysical) return /路线|安全|保险|补给|应急/.test(evidence);
      if (profile.formality === "正式呈现") return /嘉宾|主持|议程|彩排|中控/.test(evidence);
      return true;
    });
    return {
      caseId: item.id,
      title: item.title,
      reason: `${scaleText}；只迁移与当前${profile.formality}、${profile.spatialScope}和${profile.participation}条件相符的做法。`,
      evidence: matchingEvidence || (/比赛|计分|奖品|登山|路线|大巴|车辆|交通|发车|保险/.test(item.summary) && profile.formality === "轻松交流"
        ? "该案例用于核对活动信息、负责人和后续归档是否完整；其场景专属配置不迁移。"
        : item.summary)
    };
  });
}

export function compactKnowledgeForPrompt(cases: Array<KnowledgeCase & { score: number }>) {
  return cases.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    details: item.details,
    evidence: item.evidence.slice(0, 2),
    reusableTips: item.reusableTips.slice(0, 3),
    pitfalls: item.pitfalls
  }));
}
