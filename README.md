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
signalos sources add-youtube <name> <channelId|channelUrl|feedUrl>
signalos ingest [--source name] [--since ISO] [--until ISO] [--dry-run] [--quiet]
signalos brief [--source name] [--since ISO] [--until ISO] [--offline] [--refresh] [--limit n] [--quiet]
signalos run [--source name] [--since ISO] [--until ISO] [--dry-run] [--offline] [--refresh] [--limit n] [--quiet]
signalos status
signalos llm config
signalos llm set [--provider name] [--base-url url] [--api-style chat_completions|responses] [--model id] [--api-key-env name]
signalos llm test [--prompt text]
signalos youtube transcript <videoId|url>
signalos youtube feed-url <channelId|channelUrl|feedUrl>
signalos media package <itemId> [--platform bilibili|xiaohongshu|douyin|wechat]
signalos media rights <itemId> <status>
```

## YouTube / Podcast

YouTube channel RSS 可以直接加入信源：

```bash
node src/cli.js sources add-youtube "AI Engineer" "UCxxxxxxxxxxxxxxxxxxxxxx"
node src/cli.js sources add-youtube "Some Channel" "https://www.youtube.com/feeds/videos.xml?channel_id=UC..."
```

摄取时会自动尝试通过 YouTube caption 接口拉字幕：

- 有字幕：字幕进入摘要上下文
- 没字幕：保留标题、描述、链接，并在评分上自然降权

单独测试视频字幕：

```bash
node src/cli.js youtube transcript "https://www.youtube.com/watch?v=VIDEO_ID"
```

在 zsh 里，带 `?` 的 URL 需要加引号。

## 信源备注

Anthropic 官方目前没有暴露新闻 RSS（`/news/rss.xml`、`/rss.xml` 均 404），因此默认配置里没有 Anthropic 源。如需接入，可以通过 RSSHub 或类似聚合服务代理，再作为普通 RSS 源加入。

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
