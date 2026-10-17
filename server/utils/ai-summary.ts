import process from "node:process"
import type { NewsItem } from "@shared/types"
import { myFetch } from "./fetch"

const MAX_LENGTH = 180
const cache = new Map<string, string>()

// These cover the terms that occur most often in the configured AI feeds. The
// fallback remains useful when no translation service is configured.
const terms: [RegExp, string][] = [
  [/large language model(s)?/gi, "大语言模型"],
  [/language model(s)?/gi, "语言模型"],
  [/vision-language/gi, "视觉语言"],
  [/multimodal/gi, "多模态"],
  [/reinforcement learning/gi, "强化学习"],
  [/machine learning/gi, "机器学习"],
  [/deep learning/gi, "深度学习"],
  [/computer vision/gi, "计算机视觉"],
  [/natural language processing/gi, "自然语言处理"],
  [/robot(ics)?/gi, "机器人"],
  [/diffusion model(s)?/gi, "扩散模型"],
  [/generative AI/gi, "生成式 AI"],
  [/reasoning/gi, "推理"],
  [/training/gi, "训练"],
  [/inference/gi, "推理部署"],
  [/benchmark(s)?/gi, "基准评测"],
  [/dataset(s)?/gi, "数据集"],
  [/agent(s)?/gi, "智能体"],
  [/fine-tuning/gi, "微调"],
]

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function shorten(value: string, max = MAX_LENGTH): string {
  const normalized = clean(value)
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1).trimEnd()}…`
}

function hasChinese(value: string): boolean {
  return /[\u3400-\u9FFF]/.test(value)
}

function translateKnownTerms(value: string): string {
  return terms.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value)
}

function fallbackSummary(item: NewsItem): string {
  const title = shorten(translateKnownTerms(item.title), 72)
  const source = clean(item.extra?.summary)
  if (hasChinese(source)) {
    return shorten(source)
  }
  const original = shorten(translateKnownTerms(source), 86)
  if (original) {
    return shorten(`主题是「${title}」，内容提到${original}。建议查看原文了解方法与结果。`)
  }
  return shorten(`主题是「${title}」，聚焦 AI 研究、模型方法或应用进展。建议查看原文了解详情。`)
}

function translatorURL(): string | undefined {
  const value = clean(process.env.AI_SUMMARY_API_URL)
  return value || undefined
}

async function remoteSummary(item: NewsItem): Promise<string | undefined> {
  const url = translatorURL()
  if (!url) return
  try {
    const response = await myFetch(url, {
      method: "POST",
      timeout: 2200,
      retry: 0,
      headers: process.env.AI_SUMMARY_API_KEY ? { Authorization: `Bearer ${process.env.AI_SUMMARY_API_KEY}` } : undefined,
      body: {
        title: item.title,
        summary: item.extra?.summary ?? "",
        targetLanguage: "zh-CN",
      },
    }) as any
    const value = response?.summaryZh
      ?? response?.summary
      ?? response?.text
      ?? response?.output
      ?? response?.choices?.[0]?.message?.content
      ?? response?.choices?.[0]?.text
    return hasChinese(clean(value)) ? shorten(clean(value)) : undefined
  } catch {
  }
}

export async function ensureChineseSummary(item: NewsItem): Promise<NewsItem> {
  const existing = clean(item.extra?.summaryZh)
  if (existing) return item

  const source = clean(item.extra?.summary)
  const key = `${item.title}\n${source}`
  let summaryZh = cache.get(key)
  if (!summaryZh) {
    summaryZh = hasChinese(source) ? shorten(source) : (await remoteSummary(item) ?? fallbackSummary(item))
    cache.set(key, summaryZh)
  }
  return {
    ...item,
    extra: { ...item.extra, summaryZh },
  }
}

export async function ensureChineseSummaries(items: NewsItem[]): Promise<NewsItem[]> {
  // Keep source refreshes responsive while still allowing an optional remote
  // translator to handle all cards. Four concurrent requests avoid a burst.
  const result: NewsItem[] = []
  for (let index = 0; index < items.length; index += 4) {
    result.push(...await Promise.all(items.slice(index, index + 4).map(ensureChineseSummary)))
  }
  return result
}
