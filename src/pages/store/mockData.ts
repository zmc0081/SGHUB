// V2.2.1 Session 28 — mock catalog for AI Store.
//
// Six products span the four provider lanes (Anthropic / OpenAI /
// DeepSeek / a multi-model bundle). Token quotas and prices are
// illustrative placeholders, not final pricing — verify with
// sgaistore.com before any production use.

import type { SgStoreProduct } from "../../lib/sgAiStoreApi";

const PURCHASE_BASE = "https://sgaistore.com/buy";

export const MOCK_PRODUCTS: SgStoreProduct[] = [
  {
    id: "claude-opus-monthly",
    name: {
      "zh-CN": "Claude Opus 月度包",
      "en-US": "Claude Opus — Monthly",
    },
    description: {
      "zh-CN":
        "Anthropic 旗舰推理模型,适合长文献深度精读、复杂 Skill 编排、多步推理。",
      "en-US":
        "Anthropic's flagship reasoning model — best for deep literature reads, complex Skill orchestration, multi-step reasoning.",
    },
    icon_url: "",
    model_provider: "anthropic",
    model_id: "claude-opus-4-7",
    billing_period: "monthly",
    price_cny: 199,
    price_usd: 28,
    token_quota: 50_000_000,
    features: {
      "zh-CN": [
        "50M tokens / 月",
        "200K 上下文窗口",
        "无需 Anthropic 账号",
        "经 SG AI Store 网关,延迟与官方接近",
      ],
      "en-US": [
        "50M tokens / month",
        "200K context window",
        "No Anthropic account required",
        "Latency comparable to official endpoint",
      ],
    },
    tags: ["popular", "deep-research"],
    popular: true,
    purchase_url: `${PURCHASE_BASE}/claude-opus-monthly`,
  },
  {
    id: "claude-opus-yearly",
    name: {
      "zh-CN": "Claude Opus 年度包",
      "en-US": "Claude Opus — Yearly",
    },
    description: {
      "zh-CN":
        "Claude Opus 全年使用。相比月度包总价节省约 16%,适合长期 AI 解析重度用户。",
      "en-US":
        "A full year of Claude Opus access — ~16% cheaper than 12 monthly packs. For sustained heavy AI Parse usage.",
    },
    icon_url: "",
    model_provider: "anthropic",
    model_id: "claude-opus-4-7",
    billing_period: "yearly",
    price_cny: 1999,
    price_usd: 280,
    token_quota: 700_000_000,
    features: {
      "zh-CN": [
        "700M tokens / 年",
        "相比月度包总价省 ~16%",
        "200K 上下文窗口",
        "支持随时退订(剩余按比例退款)",
      ],
      "en-US": [
        "700M tokens / year",
        "~16% cheaper than 12 × monthly",
        "200K context window",
        "Cancel anytime, prorated refund",
      ],
    },
    tags: ["best-value"],
    popular: false,
    purchase_url: `${PURCHASE_BASE}/claude-opus-yearly`,
  },
  {
    id: "claude-sonnet-monthly",
    name: {
      "zh-CN": "Claude Sonnet 月度包",
      "en-US": "Claude Sonnet — Monthly",
    },
    description: {
      "zh-CN":
        "Anthropic 主力模型,速度比 Opus 快 ~3 倍,价格更低。适合常规 Chat 与轻量 Skill。",
      "en-US":
        "Anthropic's workhorse — ~3x faster than Opus at a lower price. Great for everyday Chat and light Skill runs.",
    },
    icon_url: "",
    model_provider: "anthropic",
    model_id: "claude-sonnet-4-5",
    billing_period: "monthly",
    price_cny: 99,
    price_usd: 14,
    token_quota: 200_000_000,
    features: {
      "zh-CN": [
        "200M tokens / 月",
        "200K 上下文窗口",
        "速度比 Opus 快 ~3 倍",
        "适合日常 Chat / 摘要 / 轻量 Skill",
      ],
      "en-US": [
        "200M tokens / month",
        "200K context window",
        "~3x faster than Opus",
        "Ideal for daily Chat / summary / light Skill",
      ],
    },
    tags: ["everyday"],
    popular: true,
    purchase_url: `${PURCHASE_BASE}/claude-sonnet-monthly`,
  },
  {
    id: "gpt5-monthly",
    name: {
      "zh-CN": "GPT-5 月度包",
      "en-US": "GPT-5 — Monthly",
    },
    description: {
      "zh-CN":
        "OpenAI 最新旗舰模型,在结构化 JSON 输出、多语言、视觉理解上表现优异。",
      "en-US":
        "OpenAI's newest flagship — excels at structured JSON output, multilingual reasoning, and visual understanding.",
    },
    icon_url: "",
    model_provider: "openai",
    model_id: "gpt-5",
    billing_period: "monthly",
    price_cny: 159,
    price_usd: 22,
    token_quota: 100_000_000,
    features: {
      "zh-CN": [
        "100M tokens / 月",
        "128K 上下文窗口",
        "原生支持图像理解",
        "强结构化 JSON 输出",
      ],
      "en-US": [
        "100M tokens / month",
        "128K context window",
        "Native vision support",
        "Strong structured-JSON output",
      ],
    },
    tags: ["vision"],
    popular: true,
    purchase_url: `${PURCHASE_BASE}/gpt5-monthly`,
  },
  {
    id: "deepseek-v3-monthly",
    name: {
      "zh-CN": "DeepSeek V3 月度包",
      "en-US": "DeepSeek V3 — Monthly",
    },
    description: {
      "zh-CN":
        "国产开源大模型,价格极具竞争力。中文场景表现优异,适合本土科研。",
      "en-US":
        "China-built open-weight model with very competitive pricing. Strong on Chinese-language tasks.",
    },
    icon_url: "",
    model_provider: "deepseek",
    model_id: "deepseek-chat",
    billing_period: "monthly",
    price_cny: 49,
    price_usd: 7,
    token_quota: 500_000_000,
    features: {
      "zh-CN": [
        "500M tokens / 月",
        "64K 上下文窗口",
        "性价比最高",
        "中文文献表现优秀",
      ],
      "en-US": [
        "500M tokens / month",
        "64K context window",
        "Best price-per-token in this catalog",
        "Excellent Chinese-language performance",
      ],
    },
    tags: ["best-price"],
    popular: false,
    purchase_url: `${PURCHASE_BASE}/deepseek-v3-monthly`,
  },
  {
    id: "multi-mix-monthly",
    name: {
      "zh-CN": "全模型混合包",
      "en-US": "Multi-Model Bundle",
    },
    description: {
      "zh-CN":
        "一份订阅,自由切换 Claude Opus / Sonnet / GPT-5 / DeepSeek。适合需要按任务对比模型的研究者。",
      "en-US":
        "One subscription, all four headline models on tap. Built for researchers who compare models per task.",
    },
    icon_url: "",
    model_provider: "multi",
    model_id: "mixed",
    billing_period: "monthly",
    price_cny: 299,
    price_usd: 42,
    token_quota: 300_000_000,
    features: {
      "zh-CN": [
        "300M tokens / 月,4 个模型共享",
        "随意切换,不分模型计费",
        "适合 AB 对比 / 多步流水线",
        "Models 页一键创建 4 个 ModelConfig",
      ],
      "en-US": [
        "300M tokens / month, shared across 4 models",
        "Switch freely, no per-model charge",
        "Great for A/B comparison / multi-step pipelines",
        "One click creates 4 ModelConfigs in Models",
      ],
    },
    tags: ["flexibility"],
    popular: true,
    purchase_url: `${PURCHASE_BASE}/multi-mix-monthly`,
  },
];
