export async function summarizeItem(item, config, { offline = false } = {}) {
  const llm = resolveLlmConfig(config);
  const apiKey = readApiKey(llm);
  if (!offline && apiKey) {
    try {
      return await summarizeWithLlm(item, llm, apiKey, config);
    } catch (error) {
      return localSummary(item, `${llm.provider} fallback: ${error.message}`);
    }
  }
  return localSummary(item);
}

export async function testLlm(config, prompt = "Hello") {
  const llm = resolveLlmConfig(config);
  const apiKey = readApiKey(llm);
  if (!apiKey) {
    throw new Error(`Missing API key. Set ${llm.apiKeyEnv}${llm.apiKeyEnv === "LLM_TOKEN" ? " or OPENAI_API_KEY" : ""}.`);
  }
  const response = await callLlm(llm, apiKey, [
    { role: "system", content: "You are a concise connectivity test assistant." },
    { role: "user", content: prompt }
  ]);
  return response.text;
}

async function summarizeWithLlm(item, llm, apiKey, config) {
  const languageInstruction = config.language === "zh-CN"
    ? "所有字段值必须使用简体中文输出；保留产品名、模型名、API 名、公司名等专有名词原文。"
    : "Use English for all field values.";
  const result = await callLlm(llm, apiKey, [
    {
      role: "system",
      content: [
        "你是面向程序员和 AI 从业者的高信号情报分析员。",
        "只输出合法 JSON，不要使用 Markdown 包裹。",
        "必须使用这些 key：chineseTitle, whatHappened, whyItMatters, devImpact, builderNotes, sourceLabel。",
        "chineseTitle 要是适合日报阅读的简体中文标题，20 字以内，保留必要英文专有名词。",
        languageInstruction,
        "不要编造事实；如果正文信息不足，要明确说明信息不足。",
        "重点关注 API、Agent 工作流、底层架构、CLI/开发自动化、可执行机会。",
        "每个字段要具体，避免空泛套话。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `Title: ${item.title}`,
        `Source: ${item.sourceName}`,
        `URL: ${item.url}`,
        `Published: ${item.publishedAt}`,
        `Content:\n${truncate(item.transcript || item.content, 12000)}`
      ].join("\n\n")
    }
  ], { json: true });
  const parsed = JSON.parse(extractJson(result.text));
  return normalizeSummary(parsed, item.sourceName);
}

async function callLlm(llm, apiKey, messages, options = {}) {
  if (llm.apiStyle === "responses") {
    return callResponses(llm, apiKey, messages);
  }
  return callChatCompletions(llm, apiKey, messages, options);
}

async function callChatCompletions(llm, apiKey, messages, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), llm.timeoutMs);
  const response = await fetch(joinUrl(llm.baseUrl, "chat/completions"), {
    method: "POST",
    headers: makeHeaders(llm, apiKey),
    signal: controller.signal,
    body: JSON.stringify({
      model: llm.model,
      temperature: 0.2,
      max_tokens: llm.maxTokens,
      messages,
      ...(options.json ? { response_format: { type: "json_object" } } : {})
    })
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`chat/completions HTTP ${response.status}: ${await safeErrorText(response)}`);
  }
  const data = await response.json();
  return { text: data.choices?.[0]?.message?.content || "" };
}

async function callResponses(llm, apiKey, messages) {
  const [system, ...rest] = messages;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), llm.timeoutMs);
  const response = await fetch(joinUrl(llm.baseUrl, "responses"), {
    method: "POST",
    headers: makeHeaders(llm, apiKey),
    signal: controller.signal,
    body: JSON.stringify({
      model: llm.model,
      instructions: system?.content || "",
      input: rest.map((message) => message.content).join("\n\n")
    })
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`responses HTTP ${response.status}: ${await safeErrorText(response)}`);
  }
  const data = await response.json();
  return { text: data.output_text || extractOutputText(data) };
}

function localSummary(item, note = "") {
  const text = truncate(item.transcript || item.content || item.title, 700);
  return {
    chineseTitle: item.title,
    whatHappened: text || item.title,
    whyItMatters: "需要 LLM 进一步判断行业影响。",
    devImpact: inferDevImpact(`${item.title} ${item.content}`),
    builderNotes: note || "行动前需要人工复核原文。",
    sourceLabel: `[${sourceKind(item.sourceType)} - ${item.sourceName}]`
  };
}

function inferDevImpact(text) {
  const lower = text.toLowerCase();
  if (hasWord(lower, "api") || hasWord(lower, "sdk")) return "可能与 API/SDK 集成有关。";
  if (hasWord(lower, "agent") || hasWord(lower, "agents")) return "可能与 Agent 工作流设计有关。";
  if (hasWord(lower, "cli")) return "可能与 CLI/开发工作流自动化有关。";
  if (hasWord(lower, "model") || hasWord(lower, "llama") || hasWord(lower, "qwen")) {
    return "可能与模型选型或能力跟踪有关。";
  }
  return "可能有用，但开发者相关性还不明确。";
}

function hasWord(text, word) {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

function sourceKind(type) {
  if (type === "youtube") return "Video";
  if (type === "podcast") return "Podcast";
  if (type === "rss") return "RSS";
  return type;
}

function normalizeSummary(summary, sourceName) {
  return {
    chineseTitle: String(summary.chineseTitle || ""),
    whatHappened: String(summary.whatHappened || ""),
    whyItMatters: String(summary.whyItMatters || ""),
    devImpact: String(summary.devImpact || ""),
    builderNotes: String(summary.builderNotes || ""),
    sourceLabel: `[LLM - ${sourceName}]`
  };
}

function resolveLlmConfig(config) {
  const llm = config.llm || {};
  return {
    provider: llm.provider || "openai",
    baseUrl: llm.baseUrl || "https://api.openai.com/v1",
    apiStyle: llm.apiStyle || "responses",
    model: llm.model || config.model || "gpt-5.4",
    apiKeyEnv: llm.apiKeyEnv || "OPENAI_API_KEY",
    authScheme: llm.authScheme || "bearer",
    timeoutMs: Number(llm.timeoutMs || 45000),
    maxTokens: Number(llm.maxTokens || 900)
  };
}

function readApiKey(llm) {
  return process.env[llm.apiKeyEnv] || (llm.apiKeyEnv === "LLM_TOKEN" ? process.env.OPENAI_API_KEY : "");
}

function makeHeaders(llm, apiKey) {
  return {
    "authorization": llm.authScheme === "raw" ? apiKey : `Bearer ${apiKey}`,
    "content-type": "application/json"
  };
}

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function extractJson(text) {
  const trimmed = String(text || "").trim();
  if (trimmed.startsWith("{")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM response did not contain JSON.");
  return match[0];
}

function extractOutputText(data) {
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((part) => part.text || "")
    .join("");
}

async function safeErrorText(response) {
  return (await response.text()).slice(0, 500);
}

function truncate(value, max) {
  return String(value || "").slice(0, max);
}
