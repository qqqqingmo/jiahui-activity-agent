import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  ClipboardCopy,
  Download,
  FileText,
  FileDown,
  History,
  Info,
  ListChecks,
  MapPin,
  MessageSquareText,
  MessageCircle,
  PackageCheck,
  PencilLine,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  TimerReset,
  Trash2,
  UserCheck,
  UsersRound,
  WalletCards,
  X
} from "lucide-react";
import type { ActivityPlan, MaterialItem, TaskItem, WorkStatus } from "../../shared/types";
import { api } from "../api";
import { copyText, currency, daysUntil, displayDate, downloadText, planToMarkdown, syncMilestoneOwners, taskExecutionProgress } from "../utils";

interface WorkspaceProps {
  plan: ActivityPlan;
  onChange: (plan: ActivityPlan) => void;
  onBack: () => void;
  onRefine: (instruction: string) => Promise<void>;
  refining: boolean;
  onToast: (message: string) => void;
}

type PlanTab = "overview" | "schedule" | "tasks" | "materials" | "notices" | "files" | "risks";

const tabs: Array<{ id: PlanTab; label: string; icon: typeof FileText }> = [
  { id: "overview", label: "总览", icon: FileText },
  { id: "schedule", label: "流程", icon: CalendarClock },
  { id: "tasks", label: "分工", icon: ListChecks },
  { id: "materials", label: "物资预算", icon: Boxes },
  { id: "notices", label: "通知", icon: MessageSquareText },
  { id: "files", label: "文件", icon: FileDown },
  { id: "risks", label: "风险", icon: ShieldAlert }
];

function Metric({ label, value, note, icon: Icon, accent }: { label: string; value: string; note: string; icon: typeof FileText; accent?: string }) {
  return <div className="metric-card">
    <span className="metric-icon" style={{ color: accent }}><Icon size={19} /></span>
    <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
  </div>;
}

function Overview({ plan }: { plan: ActivityPlan }) {
  const days = daysUntil(plan.brief.date);
  return <div className="tab-content overview-grid">
    <section className="content-card overview-main">
      <div className="card-kicker">方案主线</div>
      <h2>{plan.theme}</h2>
      <p className="lead-copy">{plan.summary}</p>
      <div className="tag-row">{plan.highlights.map((item) => <span className="soft-tag" key={item}>{item}</span>)}</div>
      <div className="content-divider" />
      <h3>这次要做到</h3>
      <div className="goal-list">
        {plan.goals.map((item, index) => <div className="goal-item" key={item}><span>{index + 1}</span><p>{item}</p></div>)}
      </div>
    </section>

    <section className="content-card planning-check-card">
      <div className="card-title-row"><div><div className="card-kicker">策划检查</div><h3>待确认事项</h3></div><AlertTriangle size={20} /></div>
      <div className="issue-list">
        {plan.planningIssues.slice(0, 4).map((item) => <div key={item}><AlertTriangle size={15} /><span>{item}</span></div>)}
        {plan.planningIssues.length === 0 && <div className="ready-row"><CheckCircle2 size={16} /> 当前没有待确认的策划信息</div>}
      </div>
    </section>

    <section className="content-card decisions-card">
      <div className="card-title-row"><div><div className="card-kicker">关键判断</div><h3>嘉会为什么这样安排</h3></div><Sparkles size={20} /></div>
      <div className="decision-list">{plan.decisions.map((item) => <article key={`${item.dimension}-${item.decision}`}><span>{item.dimension}</span><strong>{item.decision}</strong><p>{item.reason}</p></article>)}</div>
    </section>

    <section className="content-card milestones-card">
      <div className="card-title-row"><div><div className="card-kicker">倒排时间表</div><h3>{days >= 0 ? `距离活动还有 ${days} 天` : "活动日期已过"}</h3></div><TimerReset size={20} /></div>
      <div className="milestone-track">
        {plan.milestones.map((item, index) => <div className="milestone" key={item.id}>
          <div className="milestone-line"><span className={item.status === "已完成" ? "done" : index === 0 ? "current" : ""}>{item.status === "已完成" ? <Check size={13} /> : index + 1}</span></div>
          <div><strong>{item.label}</strong><span>{displayDate(item.date)}</span><small>{item.owner}</small></div>
        </div>)}
      </div>
    </section>

    <section className="content-card references-card">
      <div className="card-title-row"><div><div className="card-kicker">经验依据</div><h3>参考了 {plan.references.length} 个过往活动</h3></div><History size={20} /></div>
      <div className="reference-list">
        {plan.references.map((item) => <div className="reference-item" key={item.caseId}>
          <div><strong>{item.title}</strong><span>{item.reason}</span></div>
          <p><Info size={14} /> {item.evidence}</p>
        </div>)}
      </div>
    </section>
  </div>;
}

function ScheduleView({ plan }: { plan: ActivityPlan }) {
  return <div className="tab-content">
    <section className="content-card schedule-card">
      <div className="card-title-row"><div><div className="card-kicker">现场 Run of Show</div><h3>{plan.brief.startTime} — {plan.brief.endTime}</h3></div><span className="outline-badge">含机动时间</span></div>
      <div className="schedule-list">
        {plan.schedule.map((item, index) => <div className="schedule-row" key={item.id}>
          <div className="schedule-time"><strong>{item.time}</strong><span>{item.duration}</span></div>
          <div className="schedule-rail"><span className={`schedule-dot type-${item.type}`}>{index + 1}</span></div>
          <div className="schedule-body">
            <div><span className={`type-badge type-${item.type}`}>{item.type}</span><h3>{item.title}</h3></div>
            <p>{item.detail}</p>
            <small><UsersRound size={13} /> {item.owner}</small>
          </div>
        </div>)}
      </div>
    </section>
  </div>;
}

const statusOrder: WorkStatus[] = ["待开始", "进行中", "已完成"];

function TasksView({ plan, onChange, onToast }: { plan: ActivityPlan; onChange: (plan: ActivityPlan) => void; onToast: (message: string) => void }) {
  const members = useMemo(() => Array.from(new Set([...plan.brief.teamMembers, ...plan.tasks.map((task) => task.owner)].filter(Boolean))), [plan]);
  const [viewer, setViewer] = useState(() => localStorage.getItem("jiahui.current-member") || localStorage.getItem("hexu.current-member") || members[0] || "总协调");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [draft, setDraft] = useState<TaskItem | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  const changeViewer = (value: string) => {
    setViewer(value);
    localStorage.setItem("jiahui.current-member", value);
  };
  const visibleTasks = scope === "mine" ? plan.tasks.filter((task) => task.owner === viewer) : plan.tasks;
  const edit = (task: TaskItem) => setDraft({ ...task, feedback: [...(task.feedback || [])] });
  const add = () => setDraft({
    id: `task-${Date.now()}`,
    title: "",
    description: "",
    owner: viewer || members[0] || "待分配",
    deadline: plan.brief.date,
    priority: "中",
    status: "待开始",
    dependency: "",
    notes: "",
    feedback: []
  });
  const save = () => {
    if (!draft?.title.trim()) return;
    const previous = plan.tasks.find((item) => item.id === draft.id);
    const exists = Boolean(previous);
    const tasks = exists ? plan.tasks.map((item) => item.id === draft.id ? draft : item) : [...plan.tasks, draft];
    const milestones = previous ? syncMilestoneOwners(plan.milestones, previous, draft) : plan.milestones;
    onChange({ ...plan, tasks, milestones });
    setDraft(null);
    onToast(exists ? "任务修改已保存" : "新任务已添加");
  };
  const remove = () => {
    if (!draft || !window.confirm(`删除任务“${draft.title || "未命名任务"}”？`)) return;
    onChange({ ...plan, tasks: plan.tasks.filter((item) => item.id !== draft.id) });
    setDraft(null);
    onToast("任务已删除");
  };
  const advance = (target: TaskItem) => {
    const next = statusOrder[(statusOrder.indexOf(target.status) + 1) % statusOrder.length];
    onChange({ ...plan, tasks: plan.tasks.map((item) => item.id === target.id ? { ...item, status: next } : item) });
  };
  const addFeedback = () => {
    if (!draft || !feedbackText.trim()) return;
    setDraft({
      ...draft,
      feedback: [...(draft.feedback || []), { id: `feedback-${Date.now()}`, author: viewer || "当前成员", content: feedbackText.trim(), createdAt: new Date().toISOString() }]
    });
    setFeedbackText("");
  };

  return <div className="tab-content tasks-view">
    <div className="task-toolbar">
      <div className="member-demo"><UserCheck size={16} /><span>当前身份</span><select value={viewer} onChange={(event) => changeViewer(event.target.value)}>{members.map((member) => <option key={member}>{member}</option>)}{members.length === 0 && <option>总协调</option>}</select><small>切换成员视角</small></div>
      <div className="task-scope"><button type="button" className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>总览台</button><button type="button" className={scope === "mine" ? "active" : ""} onClick={() => setScope("mine")}>我的任务</button></div>
      <button type="button" className="primary-button compact" onClick={add}><Plus size={16} /> 添加任务</button>
    </div>
    {scope === "mine" && <div className="personal-task-summary"><strong>{viewer}</strong> 当前负责 {visibleTasks.length} 项任务，其中 {visibleTasks.filter((item) => item.status === "已完成").length} 项已完成。</div>}
    <div className="task-board">
      {statusOrder.map((status) => {
        const items = visibleTasks.filter((item) => item.status === status);
        return <section className="task-column" key={status}>
          <div className="task-column-header"><span className={`status-mark status-${status}`} /> <strong>{status}</strong><small>{items.length}</small></div>
          <div className="task-column-list">
            {items.map((item) => <article className="task-card" key={item.id} onClick={() => edit(item)}>
              <div className="task-card-top"><span className={`priority priority-${item.priority}`}>{item.priority}优先级</span><button type="button" className="quick-status" title="推进到下一状态" onClick={(event) => { event.stopPropagation(); advance(item); }}><ChevronRight size={15} /></button></div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              {item.dependency && <span className="dependency">前置：{item.dependency}</span>}
              {Boolean(item.notes || item.feedback?.length) && <div className="task-signals">{item.notes && <span><FileText size={12} /> 有备注</span>}{Boolean(item.feedback?.length) && <span><MessageCircle size={12} /> {item.feedback?.length} 条反馈</span>}</div>}
              <div className="task-meta"><span><CalendarClock size={13} /> {item.deadline}</span><span><UsersRound size={13} /> {item.owner}</span></div>
            </article>)}
            {items.length === 0 && <div className="empty-column">暂无任务</div>}
          </div>
        </section>;
      })}
    </div>

    {draft && <div className="drawer-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setDraft(null)}>
      <aside className="task-editor-drawer">
        <div className="drawer-header"><div><div className="eyebrow"><ListChecks size={14} /> 任务详情</div><h2>{plan.tasks.some((item) => item.id === draft.id) ? "编辑任务" : "添加任务"}</h2></div><button type="button" className="icon-button" aria-label="关闭任务" onClick={() => setDraft(null)}><X size={20} /></button></div>
        <div className="task-editor-fields">
          <label className="field"><span>任务名称</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="写清楚要完成什么" autoFocus /></label>
          <label className="field"><span>执行说明</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <div className="task-editor-grid">
            <label className="field"><span>负责人</span><input list="task-owner-list" value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /><datalist id="task-owner-list">{members.map((member) => <option value={member} key={member} />)}</datalist></label>
            <label className="field"><span>截止日期</span><input type="date" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} /></label>
            <label className="field"><span>状态</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as WorkStatus })}>{statusOrder.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field"><span>优先级</span><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as TaskItem["priority"] })}>{["高", "中", "低"].map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <label className="field"><span>前置任务</span><input value={draft.dependency || ""} onChange={(event) => setDraft({ ...draft, dependency: event.target.value })} placeholder="没有可留空" /></label>
          <label className="field"><span>任务备注</span><textarea rows={3} value={draft.notes || ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="补充文件位置、联系方式、执行口径等" /></label>
        </div>
        <section className="task-feedback-panel"><div><strong>反馈记录</strong><small>成员可以在自己的任务页补充进展或提出问题</small></div>{(draft.feedback || []).map((item) => <article key={item.id}><span>{item.author}</span><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleString("zh-CN")}</time></article>)}{(draft.feedback || []).length === 0 && <p className="empty-feedback">还没有反馈</p>}<div className="feedback-compose"><textarea rows={2} value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder={`以 ${viewer} 的身份补充反馈`} /><button type="button" onClick={addFeedback} disabled={!feedbackText.trim()}>添加</button></div></section>
        <div className="task-editor-actions"><button type="button" className="danger-text-button" onClick={remove}><Trash2 size={15} /> 删除</button><button type="button" className="primary-button" onClick={save} disabled={!draft.title.trim()}><Save size={16} /> 保存任务</button></div>
      </aside>
    </div>}
  </div>;
}

function MaterialsView({ plan, onChange }: { plan: ActivityPlan; onChange: (plan: ActivityPlan) => void }) {
  const total = plan.budgetItems.reduce((sum, item) => sum + item.amount, 0);
  const checked = plan.materials.filter((item) => item.checked).length;
  const toggle = (target: MaterialItem) => onChange({
    ...plan,
    materials: plan.materials.map((item) => item.id === target.id ? { ...item, checked: !item.checked } : item)
  });
  return <div className="tab-content material-layout">
    <section className="content-card material-table-card">
      <div className="card-title-row"><div><div className="card-kicker">物资清单</div><h3>{checked} / {plan.materials.length} 已备齐</h3></div><PackageCheck size={21} /></div>
      <div className="progress-line"><span style={{ width: `${(checked / plan.materials.length) * 100}%` }} /></div>
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>状态</th><th>物资</th><th>数量</th><th>估算</th><th>负责人</th><th>截止</th></tr></thead>
        <tbody>{plan.materials.map((item) => <tr key={item.id} className={item.checked ? "checked" : ""}>
          <td><button type="button" className="check-button" aria-label={`标记${item.item}`} onClick={() => toggle(item)}>{item.checked ? <CheckCircle2 size={19} /> : <Circle size={19} />}</button></td>
          <td><strong>{item.item}{item.required && <i className="required-dot" />}</strong><small>{item.category}</small></td>
          <td>{item.quantity} {item.unit}</td><td>{currency(item.estimate)}</td><td>{item.owner}</td><td>{item.deadline}</td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <aside className="content-card budget-card">
      <div className="card-title-row"><div><div className="card-kicker">预算分配</div><h3>{currency(total)}</h3></div><WalletCards size={21} /></div>
      <p className="muted-copy">按实际必要项估算，不为花满上限补无关支出；机动费在活动结束前不提前占用。</p>
      <div className="budget-bar">{plan.budgetItems.map((item, index) => <span key={item.item} className={`budget-segment segment-${index}`} style={{ width: `${total ? item.amount / total * 100 : 0}%` }} title={item.item} />)}</div>
      <div className="budget-list">{plan.budgetItems.map((item, index) => <div key={item.item}>
        <span><i className={`legend-dot segment-${index}`} /> {item.item}<small>{item.note}</small></span><strong>{currency(item.amount)}</strong>
      </div>)}</div>
    </aside>
  </div>;
}

function NoticesView({ plan, onToast }: { plan: ActivityPlan; onToast: (message: string) => void }) {
  const [active, setActive] = useState<keyof ActivityPlan["notices"]>("initial");
  const labels = { initial: "首次通知", reminder: "行前提醒", onsite: "现场通知" };
  const copy = async () => {
    const copied = await copyText(plan.notices[active]);
    onToast(copied ? "通知已复制，可以直接发到班群" : "浏览器没有开放剪贴板权限，请手动选择文案");
  };
  return <div className="tab-content notice-layout">
    <section className="content-card notice-editor">
      <div className="notice-tabs">{(Object.keys(labels) as Array<keyof typeof labels>).map((key) => <button type="button" key={key} className={active === key ? "active" : ""} onClick={() => setActive(key)}>{labels[key]}</button>)}</div>
      <div className="notice-paper"><pre>{plan.notices[active]}</pre></div>
      <button type="button" className="secondary-button copy-button" onClick={copy}><ClipboardCopy size={17} /> 复制这段通知</button>
    </section>
    <aside className="content-card notice-tips">
      <div className="card-kicker">发送节奏</div><h3>把信息拆成三次发</h3>
      <div className="send-step"><span>1</span><div><strong>首次通知</strong><p>先完成出席确认、忌口与特殊需求收集。</p></div></div>
      <div className="send-step"><span>2</span><div><strong>行前提醒</strong><p>活动前一天只发需要记住的时间、地点和携带物。</p></div></div>
      <div className="send-step"><span>3</span><div><strong>现场通知</strong><p>短句说明签到点、联系人和异常情况怎么报。</p></div></div>
    </aside>
  </div>;
}

function RisksView({ plan }: { plan: ActivityPlan }) {
  return <div className="tab-content risk-list">
    {plan.risks.map((risk) => <section className={`content-card risk-card risk-${risk.level}`} key={risk.id}>
      <div className="risk-level"><span>{risk.level}风险</span><ShieldAlert size={19} /></div>
      <h3>{risk.item}</h3>
      <div className="risk-detail"><span>触发条件</span><p>{risk.trigger}</p></div>
      <div className="risk-detail"><span>现场动作</span><p>{risk.response}</p></div>
      <div className="risk-owner"><UsersRound size={14} /> {risk.owner}</div>
    </section>)}
  </div>;
}

function FilesView({ plan, onToast }: { plan: ActivityPlan; onToast: (message: string) => void }) {
  const [downloading, setDownloading] = useState<"prefilled" | "blank" | "">("");
  const download = async (kind: "prefilled" | "blank") => {
    setDownloading(kind);
    try {
      await (kind === "prefilled" ? api.downloadPrefilledExpenseForm(plan) : api.downloadBlankExpenseForm());
      onToast(kind === "prefilled" ? "预填写经费表已下载" : "空白经费表模板已下载");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "文件下载失败");
    } finally {
      setDownloading("");
    }
  };
  return <div className="tab-content file-center">
    <section className="content-card file-intro-card"><div className="card-kicker">活动文件</div><h2>经费支出明细表</h2><p>预填写版本会带入活动名称、日期、地点、活动内容和预算明细。签字、盖章和审批意见保留为空。</p><div className="file-preview-meta"><span>{plan.brief.title}</span><span>{plan.budgetItems.length} 条预算明细</span><span>{currency(plan.budgetItems.reduce((sum, item) => sum + item.amount, 0))}</span></div></section>
    <section className="content-card file-download-card"><div className="file-icon"><FileDown size={25} /></div><div><strong>预填写经费表</strong><p>根据当前活动方案即时生成 Word 文件；修改方案后可重新下载。</p></div><button type="button" className="primary-button" disabled={Boolean(downloading)} onClick={() => download("prefilled")}>{downloading === "prefilled" ? <><span className="spinner" /> 生成中</> : <><Download size={16} /> 下载预填写表</>}</button></section>
    <section className="content-card file-download-card"><div className="file-icon neutral"><FileText size={25} /></div><div><strong>空白模板</strong><p>保留北京大学原始表格版式，供手动填写或临时备用。</p></div><button type="button" className="secondary-button" disabled={Boolean(downloading)} onClick={() => download("blank")}>{downloading === "blank" ? <><span className="spinner dark" /> 下载中</> : <><Download size={16} /> 下载空白模板</>}</button></section>
  </div>;
}

export function Workspace({ plan, onChange, onBack, onRefine, refining, onToast }: WorkspaceProps) {
  const [tab, setTab] = useState<PlanTab>("overview");
  const [refineOpen, setRefineOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const metrics = useMemo(() => {
    const completed = plan.tasks.filter((item) => item.status === "已完成").length;
    return { completed, progress: taskExecutionProgress(plan.tasks), days: daysUntil(plan.brief.date), budget: plan.budgetItems.reduce((sum, item) => sum + item.amount, 0) };
  }, [plan]);

  const exportPlan = () => {
    downloadText(`${plan.brief.title.replace(/[\\/:*?"<>|]/g, "-") || "活动方案"}.md`, planToMarkdown(plan));
    onToast("方案已导出为 Markdown");
  };

  const submitRefine = async () => {
    if (!instruction.trim()) return;
    await onRefine(instruction.trim());
    setInstruction("");
    setRefineOpen(false);
  };

  return <main className="workspace-page">
    <header className="workspace-header">
      <div className="workspace-topline">
        <button type="button" className="icon-text-button" onClick={onBack}><ArrowLeft size={17} /> 返回简报</button>
        <div className="workspace-actions">
          <span className={`model-badge ${plan.generatedBy}`}><Sparkles size={14} /> {plan.generatedBy === "model" ? "智能规划" : "基础草案"}</span>
          <button type="button" className="secondary-button" onClick={() => setRefineOpen(true)}><PencilLine size={16} /> 反馈并调整</button>
          <button type="button" className="primary-button compact" onClick={exportPlan}><Download size={16} /> 导出方案</button>
        </div>
      </div>
      <div className="workspace-title-row">
        <div><div className="eyebrow">活动方案 <span>草案</span></div><h1>{plan.brief.title}</h1><p><CalendarClock size={15} /> {plan.brief.date} {plan.brief.startTime}—{plan.brief.endTime}<i /> <MapPin size={15} /> {plan.brief.location || "地点待定"}</p></div>
        <div className="mini-team">{plan.brief.teamMembers.slice(0, 4).map((name, index) => <span key={`${name}-${index}`} title={name}>{name.slice(0, 1)}</span>)}{plan.brief.teamMembers.length > 4 && <b>+{plan.brief.teamMembers.length - 4}</b>}</div>
      </div>
      <div className="metrics-row">
        <Metric icon={ClipboardCheck} label="执行进度" value={`${metrics.progress}%`} note="按任务状态与优先级加权" accent="#4567e8" />
        <Metric icon={CalendarClock} label="活动倒计时" value={metrics.days >= 0 ? `${metrics.days} 天` : "已到期"} note={displayDate(plan.brief.date)} accent="#e27b49" />
        <Metric icon={ListChecks} label="任务进度" value={`${metrics.completed}/${plan.tasks.length}`} note="按任务清单统计" accent="#2e8d72" />
        <Metric icon={WalletCards} label="建议预算" value={currency(metrics.budget)} note={`范围 ${currency(plan.brief.budgetMin)}—${currency(plan.brief.budgetMax)}`} accent="#8357c5" />
      </div>
    </header>

    <nav className="workspace-tabs">
      {tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={16} /> {label}</button>)}
    </nav>

    <div className="workspace-body">
      {tab === "overview" && <Overview plan={plan} />}
      {tab === "schedule" && <ScheduleView plan={plan} />}
      {tab === "tasks" && <TasksView plan={plan} onChange={onChange} onToast={onToast} />}
      {tab === "materials" && <MaterialsView plan={plan} onChange={onChange} />}
      {tab === "notices" && <NoticesView plan={plan} onToast={onToast} />}
      {tab === "files" && <FilesView plan={plan} onToast={onToast} />}
      {tab === "risks" && <RisksView plan={plan} />}
    </div>

    {refineOpen && <div className="drawer-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setRefineOpen(false)}>
      <aside className="refine-drawer">
        <div className="drawer-header"><div><div className="eyebrow"><PencilLine size={14} /> 方案反馈</div><h2>指出哪里不合理</h2></div><button type="button" className="icon-button" aria-label="关闭反馈" onClick={() => setRefineOpen(false)}><X size={20} /></button></div>
        <p>可以直接说哪些环节不合适、希望更轻松还是更正式，相关流程、物资、任务和通知会一起修改。</p>
        <div className="prompt-suggestions">
          {["这个活动以自由交流为主，删掉没有必要的主持和分组", "预算改为 5000 到 7000 元，餐饮优先", "流程太满了，保留核心体验并缩短时长"].map((item) => <button type="button" key={item} onClick={() => setInstruction(item)}>{item}</button>)}
        </div>
        <label className="field refine-field"><span>你的反馈</span><textarea rows={6} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：这是一次小规模自由交流，不需要主持、分组和复杂物料，流程再轻一些" autoFocus /></label>
        <div className="drawer-hint"><Info size={15} /> 反馈会作为本次方案的修改依据，并保留在当前活动中。</div>
        <button type="button" className="primary-button drawer-submit" disabled={!instruction.trim() || refining} onClick={submitRefine}>{refining ? <><span className="spinner" /> 正在重新检查方案</> : <><Sparkles size={17} /> 根据反馈修改</>}</button>
      </aside>
    </div>}
  </main>;
}
