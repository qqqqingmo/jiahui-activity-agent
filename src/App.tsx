import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  ChevronLeft,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Settings2,
  Sparkles
} from "lucide-react";
import type { ActivityBrief, ActivityPlan, HealthResponse, KnowledgeCase } from "../shared/types";
import { api } from "./api";
import { BriefForm } from "./components/BriefForm";
import { KnowledgeView } from "./components/KnowledgeView";
import { ProjectsView } from "./components/ProjectsView";
import { RuntimeSettingsModal } from "./components/RuntimeSettingsModal";
import { Workspace } from "./components/Workspace";

type View = "new" | "projects" | "knowledge" | "workspace";
const STORAGE_KEY = "jiahui.activity-plans.v3";
const PREVIOUS_STORAGE_KEY = "hexu.activity-plans.v2";
const LEGACY_STORAGE_KEY = "bance.activity-plans.v1";
const KNOWLEDGE_STORAGE_KEY = "jiahui.imported-history.v2";
const PREVIOUS_KNOWLEDGE_STORAGE_KEY = "hexu.imported-history.v1";

function normalizePlan(value: ActivityPlan & { generatedBy?: string; brief: ActivityBrief & { budget?: number }; readiness?: { issues?: string[] } }): ActivityPlan {
  const legacyBudget = Number(value.brief.budget || 0);
  const generatedBy = value.generatedBy as string | undefined;
  return {
    ...value,
    generatedBy: generatedBy === "deepseek" ? "model" : generatedBy === "local" ? "rules" : generatedBy === "rules" ? "rules" : "model",
    brief: {
      ...value.brief,
      type: value.brief.type === ("班级团建" as ActivityBrief["type"]) ? "集体团建" : value.brief.type,
      budgetMin: value.brief.budgetMin ?? Math.round(legacyBudget * 0.8),
      budgetMax: value.brief.budgetMax ?? legacyBudget
    },
    decisions: value.decisions?.length ? value.decisions : [{ dimension: "方案迁移", decision: "待重新生成", reason: "这份活动创建于旧版本；重新生成后会补充通用的关键判断。" }],
    planningIssues: value.planningIssues || value.readiness?.issues || [],
    tasks: (value.tasks || []).map((task) => ({ ...task, notes: task.notes || "", feedback: task.feedback || [] }))
  } as ActivityPlan;
}

function readPlans(): ActivityPlan[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(PREVIOUS_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return value ? (JSON.parse(value) as ActivityPlan[]).map((plan) => normalizePlan(plan as ActivityPlan & { generatedBy?: string; brief: ActivityBrief & { budget?: number } })) : [];
  } catch {
    return [];
  }
}

function readImportedKnowledge(): KnowledgeCase[] {
  try {
    const value = localStorage.getItem(KNOWLEDGE_STORAGE_KEY) || localStorage.getItem(PREVIOUS_KNOWLEDGE_STORAGE_KEY);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [view, setView] = useState<View>("new");
  const [plans, setPlans] = useState<ActivityPlan[]>(readPlans);
  const [activePlan, setActivePlan] = useState<ActivityPlan | null>(null);
  const [draftBrief, setDraftBrief] = useState<ActivityBrief | undefined>();
  const [health, setHealth] = useState<HealthResponse>({ ok: false, modelAvailable: false, model: "", baseUrl: "", reviewEnabled: true, knowledgeCases: 0 });
  const [knowledge, setKnowledge] = useState<KnowledgeCase[]>([]);
  const [importedKnowledge, setImportedKnowledge] = useState<KnowledgeCase[]>(readImportedKnowledge);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("检索历史经验");
  const [refining, setRefining] = useState(false);
  const [toast, setToast] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refreshHealth = () => api.health().then(setHealth).catch(() => undefined);

  useEffect(() => {
    refreshHealth();
    api.knowledge().then((result) => setKnowledge(result.cases)).catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(importedKnowledge));
  }, [importedKnowledge]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [view, activePlan?.id]);

  const activeNav = view === "workspace" ? "projects" : view;

  const openView = (next: View) => {
    if (next !== "workspace") setView(next);
    if (next === "new") setDraftBrief(undefined);
  };

  const savePlan = (plan: ActivityPlan) => {
    setActivePlan(plan);
    setPlans((current) => {
      const exists = current.some((item) => item.id === plan.id);
      return exists ? current.map((item) => item.id === plan.id ? plan : item) : [plan, ...current];
    });
  };

  const generate = async (brief: ActivityBrief) => {
    setLoading(true);
    setLoadingText("检索相似活动");
    const timers = [
      window.setTimeout(() => setLoadingText("编排流程与分工"), 650),
      window.setTimeout(() => setLoadingText("核对预算和风险"), 1500)
    ];
    try {
      const result = await api.generate({ brief, mode: "model", knowledgeCases: importedKnowledge });
      savePlan(result.plan);
      setView("workspace");
      setToast(result.meta.message);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "方案生成失败，请稍后再试");
    } finally {
      timers.forEach(window.clearTimeout);
      setLoading(false);
    }
  };

  const importHistory = async (files: File[]) => {
    const result = await api.importHistory(files);
    setImportedKnowledge((current) => [result.case, ...current.filter((item) => item.id !== result.case.id)]);
    setToast(`已整理“${result.case.title}”并加入历史活动`);
    return result;
  };

  const refine = async (instruction: string) => {
    if (!activePlan) return;
    setRefining(true);
    try {
      const result = await api.refine({ plan: activePlan, instruction });
      savePlan(result.plan);
      setToast(result.meta.message);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "这次调整没有完成");
    } finally {
      setRefining(false);
    }
  };

  const projectCount = useMemo(() => plans.length, [plans]);

  return <div className={`app-layout view-${view}`}>
    <aside className="app-sidebar">
      <div className="brand">
        <span className="brand-mark"><i /><b /></span>
        <div><strong>嘉会</strong><small>JIAHUI</small></div>
      </div>
      <button type="button" className="new-plan-button" onClick={() => openView("new")}><Plus size={18} /><span>新建活动</span></button>
      <nav className="main-nav">
        <button type="button" className={activeNav === "new" ? "active" : ""} onClick={() => openView("new")}><LayoutDashboard size={18} /><span>策划工作台</span></button>
        <button type="button" className={activeNav === "projects" ? "active" : ""} onClick={() => openView("projects")}><FolderKanban size={18} /><span>我的活动</span>{projectCount > 0 && <i>{projectCount}</i>}</button>
        <button type="button" className={activeNav === "knowledge" ? "active" : ""} onClick={() => openView("knowledge")}><BookOpenCheck size={18} /><span>历史活动</span><i>{knowledge.length + importedKnowledge.length}</i></button>
      </nav>
      <div className="sidebar-spacer" />
      <section className="sidebar-status">
        <div><Sparkles size={16} /><span><strong>智能规划</strong><small>{health.modelAvailable ? health.model : "未连接模型"}</small></span></div>
        <span className={`status-dot ${health.modelAvailable ? "online" : ""}`} />
      </section>
      <button type="button" className="sidebar-footer" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /><span>运行配置</span><ChevronLeft size={14} /></button>
      <div className="sidebar-version">活动策划 Agent · v1.2</div>
    </aside>

    <div className="app-main">
      {view === "new" && <BriefForm initial={draftBrief} modelAvailable={health.modelAvailable} loading={loading} loadingText={loadingText} onGenerate={generate} onOpenSettings={() => setSettingsOpen(true)} />}
      {view === "projects" && <ProjectsView plans={plans} onOpen={(plan) => { setActivePlan(plan); setView("workspace"); }} onNew={() => openView("new")} onDelete={(id) => { if (window.confirm("删除这个活动？")) setPlans((current) => current.filter((item) => item.id !== id)); }} />}
      {view === "knowledge" && <KnowledgeView cases={[...importedKnowledge, ...knowledge]} modelAvailable={health.modelAvailable} onImport={importHistory} onOpenSettings={() => setSettingsOpen(true)} onDeleteImported={(id) => setImportedKnowledge((current) => current.filter((item) => item.id !== id))} />}
      {view === "workspace" && activePlan && <Workspace plan={activePlan} onChange={savePlan} onBack={() => { setDraftBrief(activePlan.brief); setView("new"); }} onRefine={refine} refining={refining} onToast={setToast} />}
    </div>

    <RuntimeSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={refreshHealth} onToast={setToast} />

    {toast && <div className="toast"><span><Sparkles size={16} /></span>{toast}</div>}
  </div>;
}
