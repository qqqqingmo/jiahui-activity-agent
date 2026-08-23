export type ActivityType =
  | "集体团建"
  | "迎新见面"
  | "学术交流"
  | "晚会庆典"
  | "比赛路演"
  | "志愿实践"
  | "其他";

export type VenueType = "室内" | "户外" | "室内外结合" | "待定";

export interface ActivityBrief {
  title: string;
  type: ActivityType;
  objective: string;
  date: string;
  startTime: string;
  endTime: string;
  attendees: number;
  budgetMin: number;
  budgetMax: number;
  location: string;
  venueType: VenueType;
  teamMembers: string[];
  mustHave: string;
  constraints: string;
}

export interface KnowledgeCase {
  id: string;
  title: string;
  year: number;
  activityType: string;
  scale: number;
  budget?: number;
  venueType: VenueType;
  sourceFiles: string[];
  tags: string[];
  summary: string;
  details?: string;
  evidence: string[];
  reusableTips: string[];
  pitfalls: string[];
  timeline?: string[];
  outcomes?: string[];
  imported?: boolean;
}

export interface ReferenceInsight {
  caseId: string;
  title: string;
  reason: string;
  evidence: string;
}

export interface PlanningDecision {
  dimension: string;
  decision: string;
  reason: string;
}

export type WorkStatus = "待开始" | "进行中" | "已完成";
export type Priority = "高" | "中" | "低";

export interface PlanMilestone {
  id: string;
  date: string;
  label: string;
  owner: string;
  status: WorkStatus;
}

export interface ScheduleItem {
  id: string;
  time: string;
  duration: string;
  title: string;
  detail: string;
  owner: string;
  type: "集合" | "活动" | "转场" | "用餐" | "机动" | "收尾";
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  owner: string;
  deadline: string;
  priority: Priority;
  status: WorkStatus;
  dependency?: string;
  notes?: string;
  feedback?: TaskFeedback[];
}

export interface TaskFeedback {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface MaterialItem {
  id: string;
  category: "场地交通" | "餐饮" | "活动道具" | "宣传物料" | "安全保障" | "奖品" | "其他";
  item: string;
  quantity: number;
  unit: string;
  estimate: number;
  owner: string;
  deadline: string;
  required: boolean;
  checked?: boolean;
}

export interface BudgetItem {
  category: string;
  item: string;
  amount: number;
  note: string;
}

export interface RiskItem {
  id: string;
  level: "高" | "中" | "低";
  item: string;
  trigger: string;
  response: string;
  owner: string;
}

export interface NoticePack {
  initial: string;
  reminder: string;
  onsite: string;
}

export interface ActivityPlan {
  id: string;
  generatedBy: "model" | "rules";
  generatedAt: string;
  brief: ActivityBrief;
  theme: string;
  summary: string;
  goals: string[];
  highlights: string[];
  decisions: PlanningDecision[];
  milestones: PlanMilestone[];
  schedule: ScheduleItem[];
  tasks: TaskItem[];
  materials: MaterialItem[];
  budgetItems: BudgetItem[];
  notices: NoticePack;
  risks: RiskItem[];
  references: ReferenceInsight[];
  planningIssues: string[];
  feedbackHistory?: Array<{
    id: string;
    instruction: string;
    createdAt: string;
  }>;
}

export interface GeneratePlanRequest {
  brief: ActivityBrief;
  mode?: "model" | "rules";
  knowledgeCases?: KnowledgeCase[];
}

export interface GeneratePlanResponse {
  plan: ActivityPlan;
  meta: {
    mode: "model" | "rules";
    message: string;
  };
}

export interface RefinePlanRequest {
  plan: ActivityPlan;
  instruction: string;
}

export interface HealthResponse {
  ok: boolean;
  modelAvailable: boolean;
  model: string;
  baseUrl: string;
  reviewEnabled: boolean;
  knowledgeCases: number;
}

export interface RuntimeSettings {
  baseUrl: string;
  model: string;
  apiKey?: string;
  hasApiKey: boolean;
  reviewEnabled: boolean;
}

export interface HistoryImportResponse {
  case: KnowledgeCase;
  parsedFiles: string[];
  skippedFiles: string[];
}
