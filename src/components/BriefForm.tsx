import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Sparkles,
  UsersRound,
  WalletCards
} from "lucide-react";
import type { ActivityBrief, ActivityType, VenueType } from "../../shared/types";
import { demoScenarios, emptyBrief } from "../demoData";

interface BriefFormProps {
  initial?: ActivityBrief;
  modelAvailable: boolean;
  loading: boolean;
  loadingText: string;
  onGenerate: (brief: ActivityBrief) => void;
  onOpenSettings: () => void;
}

const activityTypes: ActivityType[] = ["集体团建", "迎新见面", "学术交流", "晚会庆典", "比赛路演", "志愿实践", "其他"];
const venueTypes: VenueType[] = ["室内", "户外", "室内外结合", "待定"];

export function BriefForm({ initial, modelAvailable, loading, loadingText, onGenerate, onOpenSettings }: BriefFormProps) {
  const [brief, setBrief] = useState<ActivityBrief>(initial || emptyBrief);
  const [memberText, setMemberText] = useState((initial?.teamMembers || []).join("、"));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initial) return;
    setBrief(initial);
    setMemberText(initial.teamMembers.join("、"));
  }, [initial]);

  const completion = useMemo(() => {
    const fields = [brief.title, brief.objective, brief.date, brief.location, brief.mustHave, brief.constraints, memberText];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [brief, memberText]);

  const set = <K extends keyof ActivityBrief>(key: K, value: ActivityBrief[K]) => {
    setBrief((current) => ({ ...current, [key]: value }));
    setError("");
  };

  const applyScenario = (index: number) => {
    const scenario = demoScenarios[index];
    setBrief(scenario.brief);
    setMemberText(scenario.brief.teamMembers.join("、"));
    setError("");
  };

  const submit = () => {
    if (!brief.title.trim() || !brief.objective.trim()) {
      setError("先补充活动名称和这次最想实现的目标。\n");
      return;
    }
    if (!brief.date || !brief.startTime || !brief.endTime) {
      setError("请填写完整的活动日期和起止时间。\n");
      return;
    }
    if (brief.budgetMin < 0 || brief.budgetMax < brief.budgetMin) {
      setError("预算上限需要大于或等于预算下限。\n");
      return;
    }
    onGenerate({
      ...brief,
      teamMembers: memberText.split(/[、,，;；\n]+/).map((item) => item.trim()).filter(Boolean)
    });
  };

  return (
    <main className="page-shell brief-page">
      <section className="page-heading brief-heading">
        <div>
          <div className="eyebrow"><Sparkles size={14} /> 新建活动</div>
          <h1>开始探索新活动吧！</h1>
          <p>填写活动目标、时间、地点、人数和预算，生成完整的活动方案与执行安排。</p>
        </div>
        <div className="completion-ring" style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}>
          <div><strong>{completion}%</strong><span>简报完整度</span></div>
        </div>
      </section>

      <div className="brief-layout">
        <section className="form-card">
          <div className="section-label"><span>01</span> 基本信息</div>
          <div className="form-grid">
            <label className="field field-wide">
              <span>活动名称</span>
              <input value={brief.title} onChange={(event) => set("title", event.target.value)} placeholder="例如：2026 秋季通班团建" />
            </label>
            <label className="field">
              <span>活动类型</span>
              <select value={brief.type} onChange={(event) => set("type", event.target.value as ActivityType)}>
                {activityTypes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="field">
              <span><CalendarDays size={15} /> 日期</span>
              <input type="date" value={brief.date} onChange={(event) => set("date", event.target.value)} />
            </label>
            <label className="field field-wide">
              <span>这次最想实现什么</span>
              <textarea value={brief.objective} onChange={(event) => set("objective", event.target.value)} placeholder="例如：参观校园公共空间，共进午餐并交流课程与生活经验" rows={3} />
              <small>目标越具体，Agent 越容易判断哪些环节该保留。</small>
            </label>
          </div>

          <div className="section-label section-gap"><span>02</span> 规模与条件</div>
          <div className="form-grid three-columns">
            <label className="field">
              <span><Clock3 size={15} /> 开始</span>
              <input type="time" value={brief.startTime} onChange={(event) => set("startTime", event.target.value)} />
            </label>
            <label className="field">
              <span><Clock3 size={15} /> 结束</span>
              <input type="time" value={brief.endTime} onChange={(event) => set("endTime", event.target.value)} />
            </label>
            <label className="field">
              <span><UsersRound size={15} /> 预计人数</span>
              <div className="input-suffix"><input type="number" min="1" value={brief.attendees} onChange={(event) => set("attendees", Number(event.target.value))} /><i>人</i></div>
            </label>
            <label className="field">
              <span><WalletCards size={15} /> 预算下限</span>
              <div className="input-suffix"><input type="number" min="0" step="100" value={brief.budgetMin} onChange={(event) => set("budgetMin", Number(event.target.value))} /><i>元</i></div>
            </label>
            <label className="field">
              <span><WalletCards size={15} /> 预算上限</span>
              <div className="input-suffix"><input type="number" min="0" step="100" value={brief.budgetMax} onChange={(event) => set("budgetMax", Number(event.target.value))} /><i>元</i></div>
            </label>
            <label className="field field-span-2">
              <span><MapPin size={15} /> 地点</span>
              <input value={brief.location} onChange={(event) => set("location", event.target.value)} placeholder="未确定可填写“待定”" />
            </label>
            <div className="field field-wide">
              <span>场地形态</span>
              <div className="segment-control">
                {venueTypes.map((item) => (
                  <button type="button" key={item} className={brief.venueType === item ? "active" : ""} onClick={() => set("venueType", item)}>{item}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="section-label section-gap"><span>03</span> 执行偏好</div>
          <div className="form-grid">
            <label className="field field-wide">
              <span>必须包含的环节</span>
              <input value={brief.mustHave} onChange={(event) => set("mustHave", event.target.value)} placeholder="例如：校园参访、自由交流、午餐、合影" />
            </label>
            <label className="field field-wide">
              <span>执行成员</span>
              <input value={memberText} onChange={(event) => setMemberText(event.target.value)} placeholder="用顿号分隔；没确定可留空，先按岗位分工" />
            </label>
            <label className="field field-wide">
              <span>限制与特别提醒</span>
              <textarea value={brief.constraints} onChange={(event) => set("constraints", event.target.value)} placeholder="例如：需要大巴往返；下雨时切换室内；避免高风险对抗" rows={3} />
            </label>
          </div>

          {error && <div className="form-error">{error}</div>}
          <div className="generate-row">
            <div className="model-ready-note"><span className={`status-dot ${modelAvailable ? "online" : ""}`} />{modelAvailable ? "模型已连接" : "需要先连接模型"}</div>
            <button type="button" className="primary-button generate-button" onClick={modelAvailable ? submit : onOpenSettings} disabled={loading}>
              {loading ? <><span className="spinner" /> {loadingText}</> : modelAvailable ? <>生成活动方案 <ArrowRight size={18} /></> : <>打开运行配置 <ArrowRight size={18} /></>}
            </button>
          </div>
        </section>

        <aside className="brief-aside">
          <section className="aside-card examples-card">
            <div className="aside-title"><span>快速开局</span><small>一键填入示例</small></div>
            {demoScenarios.map((scenario, index) => (
              <button type="button" className="scenario-item" key={scenario.id} onClick={() => applyScenario(index)}>
                <span className="scenario-icon">{scenario.icon}</span>
                <span><strong>{scenario.label}</strong><small>{scenario.note}</small></span>
                <ArrowRight size={16} />
              </button>
            ))}
          </section>

          <section className="aside-card deliverables-card">
            <div className="aside-title"><span>方案包含</span></div>
            {["按分钟排好的现场流程", "带截止日和依赖的任务分工", "可勾选的物资与预算", "3 类可直接发送的班群通知", "有触发条件的风险预案", "引用了哪些历史活动经验"].map((item) => (
              <div className="deliverable" key={item}><Check size={15} /> {item}</div>
            ))}
          </section>

          <section className="aside-card privacy-card">
            <span className={`status-dot ${modelAvailable ? "online" : ""}`} />
            <div><strong>{modelAvailable ? "智能规划已就绪" : "尚未连接模型"}</strong><small>{modelAvailable ? "生成后可继续反馈和修改" : "可从左下角运行配置中连接"}</small></div>
          </section>
        </aside>
      </div>
    </main>
  );
}
