import { useEffect, useState } from "react";
import { api, type AppConfig } from "../lib/tauri";

const LANG_LABEL: Record<string, string> = {
  "zh-CN": "中文 (简体)",
  "en-US": "English (US)",
};

const THEME_LABEL: Record<string, string> = {
  light: "亮色",
  dark: "暗色",
  system: "跟随系统",
};

const LOG_LEVEL_LABEL: Record<string, string> = {
  debug: "Debug (详细)",
  info: "Info (默认)",
  warn: "Warn",
  error: "Error",
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-3 border-b border-black/5">
      <dt className="text-sm text-app-fg/60">{label}</dt>
      <dd className="text-sm text-app-fg">{children}</dd>
    </div>
  );
}

export default function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAppConfig()
      .then(setConfig)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-primary mb-1">设置</h1>
      <p className="text-sm text-app-fg/60 mb-6">
        当前从 mock 数据加载,后续接 ~/.sghub/config.toml
      </p>

      {loading && <div className="text-sm text-app-fg/60">加载中…</div>}
      {error && <div className="text-sm text-red-600">错误: {error}</div>}

      {config && (
        <div className="bg-white rounded border border-black/10 px-6 py-2">
          <Row label="语言">
            {LANG_LABEL[config.language] ?? config.language}
          </Row>
          <Row label="主题">
            {THEME_LABEL[config.theme] ?? config.theme}
          </Row>
          <Row label="数据目录">
            <code className="text-xs bg-black/5 px-1.5 py-0.5 rounded">
              {config.data_dir}
            </code>
          </Row>
          <Row label="自动更新">
            <span
              className={
                config.auto_update ? "text-green-700" : "text-app-fg/50"
              }
            >
              ● {config.auto_update ? "开启" : "关闭"}
            </span>
          </Row>
          {/* "自动备份" 设置项已于 V2.1.0 移除 —— 后端 auto_backup /
              backup_retention_days 字段保留供未来扩展,但 UI 不再展示。 */}
          <Row label="默认模型">
            {config.default_model_id ? (
              <code className="text-xs">{config.default_model_id}</code>
            ) : (
              <span className="text-app-fg/50">未设置</span>
            )}
          </Row>
          <Row label="日志级别">
            {LOG_LEVEL_LABEL[config.log_level] ?? config.log_level}
          </Row>
        </div>
      )}
    </div>
  );
}
