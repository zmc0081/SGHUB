import { useEffect, useState } from "react";
import { api, type ModelConfig, type TestResult } from "../lib/tauri";

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  ollama: "Ollama (本地)",
  custom: "自定义",
};

function ModelCard({ model }: { model: ModelConfig }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const test = () => {
    setTesting(true);
    setResult(null);
    api
      .testModelConnection(model.id)
      .then(setResult)
      .catch((e) =>
        setResult({
          success: false,
          latency_ms: 0,
          message: String(e),
          model_response: null,
        }),
      )
      .finally(() => setTesting(false));
  };

  return (
    <div className="bg-white rounded border border-black/10 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-primary">
              {model.name}
            </h2>
            {model.is_default && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold">
                默认
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-app-fg/60">
            {PROVIDER_LABEL[model.provider] ?? model.provider} ·{" "}
            <code className="text-app-fg/80">{model.model_id}</code>
          </div>
        </div>
        <button
          onClick={test}
          disabled={testing}
          className="shrink-0 px-3 py-1.5 text-xs rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
        >
          {testing ? "测试中…" : "测试连接"}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-[80px_1fr] gap-y-1.5 text-xs">
        <dt className="text-app-fg/50">Endpoint</dt>
        <dd className="text-app-fg/80 font-mono">{model.endpoint}</dd>
        <dt className="text-app-fg/50">Max tokens</dt>
        <dd className="text-app-fg/80">{model.max_tokens.toLocaleString()}</dd>
        <dt className="text-app-fg/50">API Key</dt>
        <dd className="text-app-fg/80">
          {model.keychain_ref ? (
            <span>
              <span className="text-green-700">●</span> 已存入 Keychain (
              <code>{model.keychain_ref}</code>)
            </span>
          ) : (
            <span className="text-app-fg/50">无需 (本地模型)</span>
          )}
        </dd>
      </dl>

      {result && (
        <div
          className={`mt-3 px-3 py-2 rounded text-xs ${
            result.success
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="font-medium">{result.message}</div>
          {result.model_response && (
            <div className="mt-1 text-app-fg/70">
              响应:「{result.model_response}」
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Models() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getModelConfigs()
      .then(setModels)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-primary mb-1">模型配置</h1>
      <p className="text-sm text-app-fg/60 mb-6">
        BYOK — API Key 存于 Windows Credential Manager,本地不留明文
      </p>

      {loading && <div className="text-sm text-app-fg/60">加载中…</div>}
      {error && <div className="text-sm text-red-600">错误: {error}</div>}

      <div className="flex flex-col gap-3">
        {models.map((m) => (
          <ModelCard key={m.id} model={m} />
        ))}
      </div>
    </div>
  );
}
