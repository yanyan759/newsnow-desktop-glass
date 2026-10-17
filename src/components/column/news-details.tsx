import type { NewsItem } from "@shared/types"

export function NewsDetails({ item }: { item: NewsItem }) {
  const summary = item.extra?.summary
  const summaryZh = item.extra?.summaryZh
  const showOriginalSummary = Boolean(summary && summary !== summaryZh)
  const timestamp = item.pubDate ? new Date(item.pubDate) : undefined
  const date = timestamp && Number.isFinite(timestamp.getTime())
    ? timestamp.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" })
    : undefined
  if (!summaryZh && !summary && !item.extra?.links?.length) return null

  return (
    <div className="ai-news-details ml-2 px-1 pb-2 text-xs leading-relaxed">
      {date && <time dateTime={timestamp!.toISOString()} className="block op-60 mb-1">{`来源日期 ${date}`}</time>}
      {summaryZh && (
        <p className="mb-1 op-90">
          <span className="font-600">
            中文概括：
          </span>
          {summaryZh}
        </p>
      )}
      {showOriginalSummary && (summary!.length > 140
        ? (
            <details className="mb-1">
              <summary className="cursor-pointer op-70">原文摘要</summary>
              <p className="mt-2 op-80 whitespace-pre-wrap">{summary}</p>
            </details>
          )
        : (
            <p className="mb-1 op-70">
              原文：
              {summary}
            </p>
          ))}
      {!!item.extra?.links?.length && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
          {item.extra.links.map(link => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-3 op-80 hover:op-100">{link.label}</a>
          ))}
        </div>
      )}
    </div>
  )
}
