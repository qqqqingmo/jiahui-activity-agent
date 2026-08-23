import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  FileStack,
  Download,
  FolderUp,
  Lightbulb,
  Search,
  Trash2,
  UsersRound,
  WalletCards,
  X
} from "lucide-react";
import type { HistoryImportResponse, KnowledgeCase } from "../../shared/types";
import { currency } from "../utils";

interface KnowledgeViewProps {
  cases: KnowledgeCase[];
  modelAvailable: boolean;
  onImport: (files: File[]) => Promise<HistoryImportResponse>;
  onOpenSettings: () => void;
  onDeleteImported: (id: string) => void;
}

export function KnowledgeView({ cases, modelAvailable, onImport, onOpenSettings, onDeleteImported }: KnowledgeViewProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<KnowledgeCase | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return cases;
    return cases.filter((item) => [item.title, item.activityType, item.summary, item.details, ...item.tags].join(" ").toLowerCase().includes(keyword));
  }, [cases, query]);

  const chooseFolder = () => {
    if (!modelAvailable) {
      onOpenSettings();
      return;
    }
    inputRef.current?.click();
  };

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setImporting(true);
    setImportError("");
    try {
      const result = await onImport(Array.from(files));
      setSelected(result.case);
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : "资料整理失败");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return <main className="page-shell knowledge-page">
    <section className="page-heading knowledge-heading">
      <div><div className="eyebrow"><BookOpenCheck size={15} /> 历史活动</div><h1>历史活动参考与资料</h1><p>查看过往活动的方案、预算、分工、流程和原始材料，为新活动提供参考。</p></div>
      <div className="knowledge-heading-actions">
        <div className="knowledge-stat"><strong>{cases.length}</strong><span>个已整理案例</span><small>{cases.filter((item) => item.imported).length} 个由你导入</small></div>
        <button type="button" className="primary-button import-button" onClick={chooseFolder}><FolderUp size={17} /> {importing ? "正在解析整理" : "导入资料文件夹"}</button>
        <input
          ref={inputRef}
          className="file-input-hidden"
          type="file"
          multiple
          accept=".docx,.xlsx,.txt,.md,.markdown,.csv,.tsv,.json"
          onChange={(event) => importFiles(event.target.files)}
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        />
      </div>
    </section>
    {importing && <div className="import-progress"><span className="spinner dark" /><div><strong>正在读取文件并整理案例</strong><small>正在整理活动名称、规模、预算、流程和可复用经验。</small></div></div>}
    {importError && <div className="form-error knowledge-error">{importError}</div>}
    <div className="knowledge-toolbar"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索团建、迎新、户外、评审……" /></label><span>找到 {filtered.length} 个案例</span></div>
    <div className="knowledge-grid">
      {filtered.map((item) => <button type="button" className="knowledge-card" key={item.id} onClick={() => setSelected(item)}>
        <div className="knowledge-card-top"><span className="case-type">{item.activityType}</span><span>{item.imported ? "新导入" : item.year}</span></div>
        <h2>{item.title}</h2><p>{item.summary}</p>
        <div className="case-metrics"><span><UsersRound size={14} /> {item.scale || "人数待确认"}{item.scale ? " 人" : ""}</span>{item.budget != null && item.budget > 0 && <span><WalletCards size={14} /> {currency(item.budget)}</span>}<span><CalendarDays size={14} /> {item.venueType}</span></div>
        <div className="case-section"><strong><Lightbulb size={15} /> 可复用做法</strong>{item.reusableTips.slice(0, 2).map((tip) => <div key={tip}>{tip}</div>)}</div>
        <footer><span><FileStack size={14} /> 来自 {item.sourceFiles.length} 份材料</span><span className="view-detail">查看详情 <ChevronRight size={14} /></span></footer>
      </button>)}
    </div>

    {selected && <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setSelected(null)}>
      <section className="history-detail-modal">
        <div className="drawer-header"><div><div className="eyebrow"><BookOpenCheck size={14} /> 历史活动详情</div><h2>{selected.title}</h2></div><button type="button" className="icon-button" aria-label="关闭详情" onClick={() => setSelected(null)}><X size={20} /></button></div>
        <div className="history-meta"><span>{selected.year}</span><span>{selected.activityType}</span><span>{selected.venueType}</span>{selected.scale > 0 && <span>{selected.scale} 人</span>}{selected.budget != null && selected.budget > 0 && <span>{currency(selected.budget)}</span>}</div>
        <p className="history-lead">{selected.details || `${selected.summary} 下面的信息来自现有材料中的流程、预算和执行记录，可作为相似活动的参考，但不会被直接照搬。`}</p>

        <div className="history-detail-grid">
          <section><h3>材料中的关键信息</h3>{selected.evidence.map((item) => <p key={item}>{item}</p>)}</section>
          <section><h3>可复用做法</h3>{selected.reusableTips.map((item) => <p key={item}>{item}</p>)}</section>
          {selected.timeline?.length ? <section><h3>筹备与流程线索</h3>{selected.timeline.map((item) => <p key={item}>{item}</p>)}</section> : null}
          {selected.outcomes?.length ? <section><h3>结果与产出</h3>{selected.outcomes.map((item) => <p key={item}>{item}</p>)}</section> : null}
        </div>

        <div className="history-warning"><AlertTriangle size={16} /><div><strong>需要留意</strong>{selected.pitfalls.map((item) => <p key={item}>{item}</p>)}</div></div>
        <div className="history-files"><strong><FileStack size={15} /> 来源材料</strong>{selected.sourceFiles.map((file, index) => selected.imported
          ? <span key={`${file}-${index}`}>{file}</span>
          : <a key={`${file}-${index}`} href={`/api/knowledge/${encodeURIComponent(selected.id)}/source/${index}`} download><Download size={13} />{file}</a>)}</div>
        {selected.imported && <button type="button" className="danger-text-button" onClick={() => { if (window.confirm("从历史活动中移除这个案例？")) { onDeleteImported(selected.id); setSelected(null); } }}><Trash2 size={15} /> 移除这个导入案例</button>}
      </section>
    </div>}
  </main>;
}
