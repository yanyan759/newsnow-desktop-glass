# AI 前沿来源与使用说明

默认首页以 AI 论文为主，保留原有玻璃窗口、拖动、缩放和托盘。

| 顺序 | 来源 | 获取方式 | 内容 |
| --- | --- | --- | --- |
| 1 | arXiv | 官方 Atom API | cs.LG / cs.CL / cs.CV / cs.AI 联合查询，按提交时间倒序、去重后取 30 篇，保留摘要、作者、分类、日期、PDF，并显示中文概括 |
| 2 | Hugging Face Daily Papers | 官方 daily_papers API | 按社区票数排序，保留论文日期与社区日期、原摘要、论文/PDF/公开代码链接，并显示中文概括 |
| 3 | TLDR AI | 归档页及最近一期页面 | 每个工作日的最近一期，提取文章与摘要，跳过标注为 Sponsor 的内容 |
| 4 | 量子位 | 官方 RSS | 中文 AI 资讯、摘要和来源日期 |
| 5 | arXivDaily | 公开论文列表 | AI 分类中文标题与摘要，注明第三方 AI 总结，提供原论文链接 |
| 6 | The Batch | 官方公开页面 | 最近周刊及来源日期，不要求每天有新一期 |
| 7 | Import AI | 官方 Substack RSS | Jack Clark 的研究、政策、安全周刊 |
| 8 | 一手动态与学习 | 固定导航 | 机器之心、新智元、Karpathy、Jim Fan、Sam Altman、Anthropic、李沐、李宏毅 |

## 刷新规则

- 应用运行时每 15 分钟检查，后台桌面窗口也检查。
- arXiv、HF、TLDR、量子位：抓取间隔 30 分钟；中文摘要与周刊：60 分钟。周期检查会复用仍有效的缓存。
- 关闭应用时不运行，电脑休眠时不执行。恢复运行后继续检查。
- arXiv 周末 RSS 可能为空，本版直接查询官方 API，显示最近论文。
- 远程请求失败时服务端尝试保留数据库中的最近成功结果，界面注明缓存；首次加载且无缓存则显示失败提示与原站入口。
- 首页固定进入 AI 前沿，原有关注内容仍保存在「关注」，综合来源可在「更多」搜索。

## 内容与日期

每张新闻卡片都会先显示“中文概括”，再按需查看原文摘要。中文来源直接复用上游中文摘要；英文来源使用本地规则生成简短说明，并保留英文原文。没有配置外部服务时不会额外联网，也不会阻塞新闻刷新。

如需接入自己的翻译/摘要服务，可在 `.env.server` 设置 `AI_SUMMARY_API_URL`，接口接收 `{ title, summary, targetLanguage: "zh-CN" }`，返回 `summaryZh`（也兼容 `summary`、`text`、`output` 或 OpenAI `choices[0].message.content`）。可选设置 `AI_SUMMARY_API_KEY`。接口超时或返回非中文文本时自动使用本地说明。

中文概括用于快速筛选，不能替代论文原文、实验条件或新闻全文；arXivDaily 的中文摘要同样需要结合原论文核验。

“来源日期”是论文/文章的来源时间，按北京时间显示；HF 的“社区 YYYY-MM-DD”是社区推荐日期。arXivDaily 的来源日期是该站页面更新日期。卡片标题下“更新/缓存”时间是本机获取时间，与论文发表日期不同。

固定导航不显示发表日期，不宣称已经自动获取 X、公众号或 B站动态。部分网站或外部链接可能需要你自己的网络条件或登录状态。

## 本机运行

本次改造目录：`E:\codexcreate\newsnow-desktop-glass`。

已安装依赖、创建本地 `.env.server` 和 `desktop-widget/config.json` 后，双击桌面「AI 前沿新闻卡片」即可运行。配置文件含本机 Node 路径，不纳入 Git。更新源码后先完全退出卡片，在项目根目录执行 `corepack pnpm build`，再启动卡片。

也可在 `desktop-widget` 目录执行 `npm start`。网页模式为 `http://127.0.0.1:4444`，需先启动桌面卡片或运行生产服务。

## 验证

```powershell
corepack pnpm exec vitest run
corepack pnpm typecheck
corepack pnpm build
Set-Location desktop-widget
npm test
node qa/ai-feeds-check.cjs
```

AI 页面验收会启动真实 Electron，检查前两张卡片、可展开摘要、PDF、真实日期、280/420/840 像素布局，以及推进浏览器时钟后是否实际请求过期来源。验收截图包含本机桌面背景，默认只保留本地并由 Git 忽略。
