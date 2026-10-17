import { load } from "cheerio"
import { XMLParser } from "fast-xml-parser"
import type { NewsItem } from "@shared/types"

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", textNodeName: "$text" })
const aiCategories = new Set(["cs.LG", "cs.CL", "cs.CV", "cs.AI"])

function list<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value]
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function plainText(value: unknown): string {
  const $ = load(typeof value === "string" ? value : "")
  $("script, style").remove()
  return text($.text())
}

function webURL(value: unknown, base?: string): string | undefined {
  if (typeof value !== "string" || !value) return
  try {
    const url = new URL(value, base)
    if (["https:", "http:"].includes(url.protocol)) return url.href
  } catch { /* Invalid upstream link. */ }
}

function unique(items: NewsItem[]): NewsItem[] {
  return [...new Map(items.map(item => [item.id, item])).values()].slice(0, 30)
}

function requireItems(items: NewsItem[]): NewsItem[] {
  if (!items.length) throw new Error("来源未返回可识别的内容，请稍后重试或查看原站")
  return unique(items)
}

export function parseArxiv(xml: string): NewsItem[] {
  const entries = list(xmlParser.parse(xml).feed?.entry)
  const seen = new Set<string>()
  const items: NewsItem[] = []
  for (const entry of entries) {
    const id = /arxiv\.org\/abs\/(\d{4}\.\d{4,5})(?:v\d+)?$/.exec(text(entry.id))?.[1]
    const title = text(entry.title)
    if (!id || !title || seen.has(id)) continue
    seen.add(id)
    const categories = list(entry.category).map(category => text(category.term)).filter(Boolean)
    const authors = list(entry.author).map(author => text(author.name)).filter(Boolean)
    items.push({
      id,
      title,
      url: `https://arxiv.org/abs/${id}`,
      pubDate: text(entry.published) || undefined,
      extra: {
        summary: text(entry.summary),
        info: [categories.join(" / "), authors.slice(0, 3).join(", ") + (authors.length > 3 ? " 等" : "")].filter(Boolean).join(" · "),
        links: [{ label: "PDF", url: `https://arxiv.org/pdf/${id}` }],
      },
    })
  }
  return requireItems(items)
}

interface HFPaper {
  paper?: {
    id?: string
    title?: string
    summary?: string
    publishedAt?: string
    submittedOnDailyAt?: string
    upvotes?: number
    githubRepo?: string
    projectPage?: string
  }
  publishedAt?: string
}

export function parseHuggingFacePapers(data: unknown): NewsItem[] {
  if (!Array.isArray(data)) throw new Error("HF Daily Papers 接口格式异常")
  const items: NewsItem[] = []
  for (const entry of [...data as HFPaper[]].sort((a, b) => (b?.paper?.upvotes ?? 0) - (a?.paper?.upvotes ?? 0))) {
    const paper = entry?.paper
    if (!paper || !/^\d{4}\.\d{4,5}$/.test(paper.id ?? "") || !text(paper.title)) continue
    const communityDate = text(paper.submittedOnDailyAt || entry.publishedAt).slice(0, 10)
    const links = [{ label: "论文原文", url: `https://arxiv.org/abs/${paper.id}` }, { label: "PDF", url: `https://arxiv.org/pdf/${paper.id}` }]
    const github = webURL(paper.githubRepo)
    const project = webURL(paper.projectPage)
    if (github) links.push({ label: "代码", url: github })
    if (project) links.push({ label: "项目", url: project })
    items.push({
      id: paper.id!,
      title: text(paper.title),
      url: `https://huggingface.co/papers/${paper.id}`,
      pubDate: text(paper.publishedAt) || undefined,
      extra: {
        summary: text(paper.summary),
        info: `${paper.upvotes ?? 0} 票${communityDate ? ` · 社区 ${communityDate}` : ""}`,
        links,
      },
    })
  }
  return requireItems(items)
}

export function parseRSSFeed(xml: string): NewsItem[] {
  const channel = xmlParser.parse(xml).rss?.channel
  return requireItems(list(channel?.item).flatMap((item) => {
    const url = webURL(item.link)
    const title = plainText(item.title)
    if (!url || !title) return []
    return [{ id: url, title, url, pubDate: text(item.pubDate) || undefined, extra: { summary: plainText(item.description) } }]
  }))
}

export function parseTLDRArchive(html: string): string {
  const $ = load(html)
  const paths = $("a[href]").toArray().map(a => $(a).attr("href")!).filter(href => /^\/ai\/\d{4}-\d{2}-\d{2}$/.test(href)).sort().reverse()
  if (!paths.length) throw new Error("TLDR AI 归档未找到最新一期")
  return `https://tldr.tech${paths[0]}`
}

export function parseTLDRIssue(html: string, date: string): NewsItem[] {
  const $ = load(html)
  return requireItems($("article").toArray().flatMap((article) => {
    const card = $(article)
    const heading = card.find("a[href]:has(h3)").first()
    const title = text(heading.text())
    const url = webURL(heading.attr("href"))
    if (!url || !title || /\bsponsor(?:ed)?\b/i.test(title)) return []
    return [{ id: url, title, url, pubDate: date, extra: { summary: text(card.find(".newsletter-html").text()), info: "TLDR AI · 本期精选" } }]
  }))
}

export function parseTheBatch(html: string): NewsItem[] {
  const $ = load(html)
  const items = $("article").toArray().flatMap((article): NewsItem[] => {
    const card = $(article)
    const anchor = card.find("a[href*=\"/the-batch/issue-\"]").first()
    const url = webURL(anchor.attr("href"), "https://www.deeplearning.ai")
    const title = text(card.find("h2, h3").first().text()) || text(anchor.attr("aria-label")) || text(anchor.text())
    if (!url || !title) return []
    const rawDate = card.find("time").attr("datetime") || card.find("a[href*=\"/the-batch/tag/\"]").toArray().map(a => text($(a).text())).find(value => /\d{4}/.test(value))
    const timestamp = rawDate ? Date.parse(rawDate) : Number.NaN
    return [{ id: url, title, url, pubDate: Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : undefined, extra: { summary: text(card.find("p").first().text()), info: "周刊 · DeepLearning.AI" } }]
  })
  return requireItems(items.sort((a, b) => Number(b.url.match(/issue-(\d+)/)?.[1]) - Number(a.url.match(/issue-(\d+)/)?.[1])))
}

export function parseArxivDaily(html: string): NewsItem[] {
  const $ = load(html)
  return requireItems($("article").toArray().flatMap((article): NewsItem[] => {
    const card = $(article)
    const anchors = card.find("a[href^=\"/papers/\"]")
    const path = anchors.first().attr("href")
    const id = path?.match(/^\/papers\/(\d{4}\.\d{4,5})$/)?.[1]
    const categories = card.find(".category-pill").toArray().map(c => text($(c).text()))
    if (!id || (categories.length && !categories.some(c => aiCategories.has(c)))) return []
    const chinese = anchors.toArray().find(a => /[\u4E00-\u9FFF]/.test($(a).text()))
    const title = text(chinese ? $(chinese).text() : anchors.first().text())
    if (!title) return []
    const summary = card.find(".summary").first().clone()
    summary.find(".summary-label").remove()
    return [{
      id,
      title,
      url: `https://www.arxivdaily.com/papers/${id}`,
      pubDate: card.attr("data-paper-updated") || undefined,
      extra: {
        summary: text(summary.text()),
        info: `第三方 AI 中文摘要${categories.length ? ` · ${categories.join(" / ")}` : ""}`,
        links: [{ label: "论文原文", url: `https://arxiv.org/abs/${id}` }, { label: "PDF", url: `https://arxiv.org/pdf/${id}` }],
      },
    }]
  }))
}
