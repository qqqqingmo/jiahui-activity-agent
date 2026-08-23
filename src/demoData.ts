import type { ActivityBrief } from "../shared/types";

export interface DemoScenario {
  id: string;
  icon: string;
  label: string;
  note: string;
  brief: ActivityBrief;
}

export const emptyBrief: ActivityBrief = {
  title: "",
  type: "集体团建",
  objective: "",
  date: "2026-09-20",
  startTime: "09:00",
  endTime: "17:30",
  attendees: 40,
  budgetMin: 8000,
  budgetMax: 12000,
  location: "",
  venueType: "室内外结合",
  teamMembers: [],
  mustHave: "",
  constraints: ""
};

export const demoScenarios: DemoScenario[] = [
  {
    id: "cat-lunch",
    icon: "🐈",
    label: "禄岛猫咪午餐会",
    note: "45 人 · 校内 · 轻松交流",
    brief: {
      title: "2026 秋季猫咪午餐会",
      type: "集体团建",
      objective: "让新老同学去禄岛看看院长养的猫，拍摄猫咪照片，共进午餐交流熟悉彼此",
      date: "2026-09-20",
      startTime: "10:30",
      endTime: "14:00",
      attendees: 45,
      budgetMin: 4500,
      budgetMax: 7000,
      location: "北京大学校内禄岛",
      venueType: "户外",
      teamMembers: ["陈同学", "林同学", "王同学"],
      mustHave: "看猫、自由拍摄、午餐交流、合影",
      constraints: "不使用闪光灯，不追逐或投喂猫咪；午餐需提前收集忌口"
    }
  },
  {
    id: "autumn",
    icon: "⛰",
    label: "秋季集体团建",
    note: "45 人 · 户外 · 一日",
    brief: {
      title: "2026 秋季通班团建",
      type: "集体团建",
      objective: "让新老同学在协作任务中熟悉彼此，同时保留轻松交流和共同记忆",
      date: "2026-09-20",
      startTime: "08:30",
      endTime: "18:30",
      attendees: 45,
      budgetMin: 14000,
      budgetMax: 17000,
      location: "北京近郊户外营地",
      venueType: "户外",
      teamMembers: ["林同学", "陈同学", "王同学", "周同学", "赵同学", "孙同学"],
      mustHave: "定向协作、集体主题游戏、合影",
      constraints: "需要大巴往返；预算含餐饮；下雨时切换室内方案；避免高风险对抗"
    }
  },
  {
    id: "welcome",
    icon: "👋",
    label: "新生见面会",
    note: "50 人 · 校内 · 2.5 小时",
    brief: {
      title: "2026 级通班新生见面会",
      type: "迎新见面",
      objective: "帮助新同学快速了解课程、科研支持和班级组织，并认识可以求助的老师与学长学姐",
      date: "2026-09-05",
      startTime: "14:00",
      endTime: "16:30",
      attendees: 50,
      budgetMin: 2800,
      budgetMax: 4000,
      location: "北京大学校内报告厅",
      venueType: "室内",
      teamMembers: ["总协调", "主持人", "学业分享", "科研分享", "后勤", "摄影"],
      mustHave: "班级介绍、新老生交流、身份纪念、合影",
      constraints: "老师发言时间待最终确认；需要投影和手持麦；会后发送资源汇总"
    }
  },
  {
    id: "roadshow",
    icon: "◫",
    label: "项目展示与路演",
    note: "80 人 · 评审 · 半日",
    brief: {
      title: "班级创新项目展示日",
      type: "比赛路演",
      objective: "让参赛项目完成清晰展示、现场验证和有效交流，并保证评审与投票流程公平顺畅",
      date: "2026-10-17",
      startTime: "13:30",
      endTime: "18:00",
      attendees: 80,
      budgetMin: 8000,
      budgetMax: 10000,
      location: "学院多功能厅",
      venueType: "室内",
      teamMembers: ["会务统筹", "评委联络", "中控", "主持", "签到", "机动"],
      mustHave: "项目路演、Demo 验证、评委问答、观众投票、颁奖",
      constraints: "每队 8 分钟展示、4 分钟问答；双路计时；投票匿名；提前半天完成设备测试"
    }
  }
];
