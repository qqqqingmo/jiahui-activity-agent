import { ArrowRight, CalendarClock, ClipboardList, FolderOpen, Plus, Trash2 } from "lucide-react";
import type { ActivityPlan } from "../../shared/types";
import { currency, displayDate, taskExecutionProgress } from "../utils";

interface ProjectsViewProps {
  plans: ActivityPlan[];
  onOpen: (plan: ActivityPlan) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ProjectsView({ plans, onOpen, onNew, onDelete }: ProjectsViewProps) {
  return <main className="page-shell projects-page">
    <section className="page-heading projects-heading"><div><div className="eyebrow"><FolderOpen size={15} /> 我的活动</div><h1>正在推进的活动</h1><p>查看和继续编辑已创建的活动方案、任务分工与执行进度。</p></div><button type="button" className="primary-button" onClick={onNew}><Plus size={17} /> 新建活动</button></section>
    {plans.length > 0 ? <div className="project-list">{plans.map((plan) => {
      const completed = plan.tasks.filter((item) => item.status === "已完成").length;
      const progress = taskExecutionProgress(plan.tasks);
      return <article className="project-card" key={plan.id}>
        <button type="button" className="project-open" onClick={() => onOpen(plan)}>
          <div className="project-date"><strong>{new Date(`${plan.brief.date}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat("zh-CN", { month: "short" }).format(new Date(`${plan.brief.date}T12:00:00`))}</span></div>
          <div className="project-info"><span className="case-type">{plan.brief.type}</span><h2>{plan.brief.title}</h2><p>{displayDate(plan.brief.date)} · {plan.brief.location || "地点待定"} · {plan.brief.attendees} 人</p></div>
          <div className="project-progress"><span>执行进度 <b>{progress}%</b></span><div><i style={{ width: `${progress}%` }} /></div><small>按任务优先级加权 · {completed}/{plan.tasks.length} 项完成 · {currency(plan.brief.budgetMin)}—{currency(plan.brief.budgetMax)}</small></div>
          <ArrowRight size={19} />
        </button>
        <button type="button" className="project-delete" aria-label={`删除${plan.brief.title}`} onClick={() => onDelete(plan.id)}><Trash2 size={16} /></button>
      </article>;
    })}</div> : <div className="empty-projects"><span><ClipboardList size={34} /></span><h2>还没有活动</h2><p>填写活动需求后，即可生成流程、分工、物资和通知等内容。</p><button type="button" className="primary-button" onClick={onNew}>创建第一个活动 <ArrowRight size={17} /></button></div>}
  </main>;
}
