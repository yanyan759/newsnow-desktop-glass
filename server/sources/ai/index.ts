import type { NewsItem } from "@shared/types"
import { defineSource } from "../../utils/source"
import { myFetch } from "../../utils/fetch"
import { parseArxiv, parseArxivDaily, parseHuggingFacePapers, parseRSSFeed, parseTLDRArchive, parseTLDRIssue, parseTheBatch } from "../../utils/ai-feeds"
import { ensureChineseSummaries } from "../../utils/ai-summary"

const fetchText = (url: string) => myFetch(url, { responseType: "text", timeout: 6000, retry: 0 })

const channels: NewsItem[] = [
  { id: "jiqizhixin", title: "机器之心", url: "https://www.jiqizhixin.com", extra: { info: "渠道入口", summary: "中文 AI 研究与产业报道；当前公开页面无法稳定抓取新闻列表，请访问原站或官方公众号。" } },
  { id: "xinzhiyuan", title: "新智元", url: "https://weixin.sogou.com/weixin?type=1&query=%E6%96%B0%E6%99%BA%E5%85%83", extra: { info: "公众号搜索入口", summary: "通过搜狗微信搜索查找新智元公众号，阅读时留意原始论文与实验条件。" } },
  { id: "karpathy", title: "Andrej Karpathy", url: "https://x.com/karpathy", extra: { info: "X · 需自行访问", summary: "模型训练、编程实践与技术思路。" } },
  { id: "jimfan", title: "Jim Fan", url: "https://x.com/DrJimFan", extra: { info: "X · 需自行访问", summary: "具身智能、机器人与世界模型。" } },
  { id: "altman", title: "Sam Altman", url: "https://x.com/sama", extra: { info: "X · 需自行访问", summary: "产品与机构动态。" } },
  { id: "anthropic", title: "Anthropic 官方", url: "https://x.com/AnthropicAI", extra: { info: "X · 需自行访问", summary: "机构研究与产品发布。", links: [{ label: "研究官网", url: "https://www.anthropic.com/research" }] } },
  { id: "limu", title: "跟李沐学 AI", url: "https://space.bilibili.com/1567748478", extra: { info: "B站 · 系统学习", summary: "深度学习课程、论文精读与工程实践。" } },
  { id: "hungyilee", title: "李宏毅课程", url: "https://search.bilibili.com/all?keyword=%E6%9D%8E%E5%AE%8F%E6%AF%85", extra: { info: "B站课程搜索", summary: "机器学习与生成式 AI 系统课程。", links: [{ label: "课程官网", url: "https://speech.ee.ntu.edu.tw/~hylee/ml/" }] } },
]

export default defineSource({
  "arxiv": async () => {
    const url = new URL("https://export.arxiv.org/api/query")
    url.search = new URLSearchParams({ search_query: "cat:cs.LG OR cat:cs.CL OR cat:cs.CV OR cat:cs.AI", sortBy: "submittedDate", sortOrder: "descending", max_results: "50" }).toString()
    return ensureChineseSummaries(parseArxiv(await fetchText(url.href)))
  },
  "huggingface": async () => ensureChineseSummaries(parseHuggingFacePapers(await myFetch("https://huggingface.co/api/daily_papers", { timeout: 6000, retry: 0 }))),
  "tldr-ai": async () => {
    const issueURL = parseTLDRArchive(await fetchText("https://tldr.tech/ai/archives"))
    return ensureChineseSummaries(parseTLDRIssue(await fetchText(issueURL), issueURL.slice(-10)))
  },
  "qbitai": async () => ensureChineseSummaries(parseRSSFeed(await fetchText("https://www.qbitai.com/feed"))),
  "arxivdaily": async () => ensureChineseSummaries(parseArxivDaily(await fetchText("https://www.arxivdaily.com/"))),
  "the-batch": async () => ensureChineseSummaries(parseTheBatch(await fetchText("https://www.deeplearning.ai/the-batch"))),
  "import-ai": async () => ensureChineseSummaries(parseRSSFeed(await fetchText("https://importai.substack.com/feed"))),
  "ai-channels": async () => ensureChineseSummaries(channels),
})
