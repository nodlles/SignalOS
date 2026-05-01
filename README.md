# SignalOS

SignalOS 是一个面向程序员和 AI 从业者的个人情报流水线，用来生成高信号 DailyBrief。

当前 v0.1 先做小闭环：

- 摄取 RSS / YouTube RSS / Podcast RSS 信源
- 严格执行 24 小时时间窗口
- 本地去重和状态记录
- RSS 内容太薄时自动补抓原文页面正文
- 默认通过太石 LLM 网关生成中文摘要
- 离线时回退到本地抽取式摘要
- 按 P0 / P1 / P2 评分分级
- 生成带原文链接的 Markdown 日报
- 为后续“翻译/解读视频并发布到其他平台”预留 rights gate 和发布包工作流

## 快速开始

```bash
npm run check
node src/cli.js init
node src/cli.js sources list
node src/cli.js llm config
node src/cli.js run --dry-run --offline
node src/cli.js run
```

默认数据目录：

- `.signalos/config.json`
- `.signalos/items.json`
- `.signalos/state.json`
- `briefs/YYYY-MM-DD.md`

## 常用命令

```bash
signalos init [--force]
signalos sources list
signalos sources add <name> <url> [--type rss|youtube|podcast]
signalos ingest [--since ISO] [--until ISO] [--dry-run]
signalos brief [--since ISO] [--until ISO] [--offline] [--refresh] [--limit n]
signalos run [--since ISO] [--until ISO] [--dry-run] [--offline] [--refresh] [--limit n]
signalos llm config
signalos llm set [--provider name] [--base-url url] [--api-style chat_completions|responses] [--model id] [--api-key-env name]
signalos llm test [--prompt text]
signalos media package <itemId> [--platform bilibili|xiaohongshu|douyin|wechat]
signalos media rights <itemId> <status>
```

## 太石 LLM 网关

默认 LLM 配置来自 `/Users/lixin/Downloads/太石LLM网关服务手册.md`：

```json
{
  "provider": "taishi",
  "baseUrl": "https://relay.tuyoo.com/v1",
  "apiStyle": "chat_completions",
  "model": "glm-4.6",
  "apiKeyEnv": "LLM_TOKEN",
  "authScheme": "bearer"
}
```

API key 不写入 `config.json`。拿到 key 后用环境变量：

```bash
export LLM_TOKEN="your-gateway-key"
node src/cli.js llm test
node src/cli.js run --refresh
```

切换模型：

```bash
node src/cli.js llm set --model gpt-5.4
node src/cli.js llm set --model claude-sonnet-4.5
node src/cli.js llm set --model moonshotai/kimi-k2-0905
```

## 视频发布工作流边界

SignalOS 把翻译视频发布视为独立的 `Transform & Publish` 工作流，而不是原样搬运。

发布前必须记录 `rightsStatus`：

- `owned`
- `licensed`
- `permission_requested`
- `permission_granted`
- `commentary_fair_use_review`
- `blocked`

CLI 可以生成发布审查包，但自动发布应放在后续 WebUI 审核和平台合规检查之后。
