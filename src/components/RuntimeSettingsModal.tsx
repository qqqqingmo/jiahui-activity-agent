import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Link2, Settings2, Sparkles, X } from "lucide-react";
import type { RuntimeSettings } from "../../shared/types";
import { api } from "../api";

interface RuntimeSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onToast: (message: string) => void;
}

const emptySettings: RuntimeSettings = {
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
  hasApiKey: false,
  reviewEnabled: true
};

export function RuntimeSettingsModal({ open, onClose, onSaved, onToast }: RuntimeSettingsModalProps) {
  const [settings, setSettings] = useState<RuntimeSettings>(emptySettings);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setApiKey("");
    setClearApiKey(false);
    api.settings().then(setSettings).catch((reason) => setError(reason instanceof Error ? reason.message : "无法读取配置"));
  }, [open]);

  if (!open) return null;

  const persist = async () => {
    setSaving(true);
    setError("");
    try {
      const next = await api.saveSettings({
        baseUrl: settings.baseUrl,
        model: settings.model,
        reviewEnabled: settings.reviewEnabled,
        apiKey: apiKey || undefined,
        clearApiKey
      });
      setSettings(next);
      setApiKey("");
      setClearApiKey(false);
      onSaved();
      onToast("运行配置已保存");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "配置保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = () => { void persist(); };

  const test = async () => {
    const saved = await persist();
    if (!saved) return;
    setTesting(true);
    setError("");
    try {
      const result = await api.testSettings();
      onToast(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "连接测试失败");
    } finally {
      setTesting(false);
    }
  };

  return <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <section className="settings-modal">
      <div className="drawer-header">
        <div><div className="eyebrow"><Settings2 size={14} /> 运行配置</div><h2>连接规划模型</h2></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="关闭配置"><X size={20} /></button>
      </div>
      <p className="settings-intro">支持提供 OpenAI 兼容 Chat Completions 接口的模型服务。配置只保存在当前后端进程中，重启后会重新读取 .env。</p>

      <div className="settings-fields">
        <label className="field"><span><Link2 size={15} /> API Base URL</span><input value={settings.baseUrl} onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://api.example.com" /></label>
        <label className="field"><span><Sparkles size={15} /> 模型名称</span><input value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))} placeholder="model-name" /></label>
        <label className="field"><span><KeyRound size={15} /> API Key</span><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings.hasApiKey ? "已配置；留空则保持不变" : "请输入 API Key"} /></label>
      </div>

      <label className="setting-toggle">
        <input type="checkbox" checked={settings.reviewEnabled} onChange={(event) => setSettings((current) => ({ ...current, reviewEnabled: event.target.checked }))} />
        <span><strong>生成后做合理性复核</strong><small>额外调用一次模型，重点排查场景矛盾和不必要环节；余额紧张时可关闭。</small></span>
      </label>

      {settings.hasApiKey && <label className="clear-key"><input type="checkbox" checked={clearApiKey} onChange={(event) => setClearApiKey(event.target.checked)} /> 清除当前 API Key</label>}
      {error && <div className="form-error">{error}</div>}

      <div className="settings-status"><CheckCircle2 size={17} /><span>{settings.hasApiKey ? `已配置 · ${settings.model}` : "尚未配置 API Key"}</span></div>
      <div className="settings-actions">
        <button type="button" className="secondary-button" disabled={saving || testing} onClick={test}>{testing ? "正在测试" : "保存并测试连接"}</button>
        <button type="button" className="primary-button" disabled={saving || !settings.baseUrl || !settings.model} onClick={save}>{saving ? "正在保存" : "保存配置"}</button>
      </div>
    </section>
  </div>;
}
