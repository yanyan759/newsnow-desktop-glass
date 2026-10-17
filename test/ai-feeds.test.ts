import { describe, expect, it } from "vitest"
import { parseArxiv, parseArxivDaily, parseHuggingFacePapers, parseRSSFeed, parseTLDRArchive, parseTLDRIssue, parseTheBatch } from "../server/utils/ai-feeds"
import { ensureChineseSummaries } from "../server/utils/ai-summary"

describe("arXiv paper ingestion", () => {
  it("uses the abstract link rather than the PDF and deduplicates paper versions", async () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
      <entry><id>http://arxiv.org/abs/2610.12345v2</id><title> A new\n model </title><published>2026-10-15T17:00:00Z</published>
        <author><name>Alice</name></author><summary> A &amp; B </summary><category term="cs.LG"/>
        <link href="https://arxiv.org/pdf/2610.12345v2" title="pdf"/><link href="https://arxiv.org/abs/2610.12345v2" rel="alternate"/></entry>
      <entry><id>http://arxiv.org/abs/2610.12345v1</id><title>Duplicate</title><category term="cs.CV"/></entry>
    </feed>`
    const items = parseArxiv(xml)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: "2610.12345", title: "A new model", url: "https://arxiv.org/abs/2610.12345", pubDate: "2026-10-15T17:00:00Z", extra: { summary: "A & B", info: "cs.LG · Alice" } })
    expect(items[0].extra?.links).toContainEqual({ label: "PDF", url: "https://arxiv.org/pdf/2610.12345" })
    expect((await ensureChineseSummaries(items))[0].extra?.summaryZh).toMatch(/[\u3400-\u9FFF]/)
  })

  it("rejects an API error instead of showing it as a paper", () => {
    expect(() => parseArxiv("<feed><entry><id>https://arxiv.org/api/errors</id><title>Error</title></entry></feed>")).toThrow()
  })
})

describe("hF Daily Papers", () => {
  it("orders papers by votes while keeping publication and community dates distinct", () => {
    const items = parseHuggingFacePapers([
      { paper: { id: "2610.11111", title: "First", summary: "Summary one", publishedAt: "2026-10-13T00:00:00Z", upvotes: 2 }, publishedAt: "2026-10-16T00:00:00Z" },
      { paper: { id: "2610.22222", title: "Second", summary: "Summary two", publishedAt: "2026-10-14T00:00:00Z", upvotes: 20, githubRepo: "https://github.com/example/model" }, publishedAt: "2026-10-16T00:00:00Z" },
      { paper: { id: "2610.33333", title: "No optional fields" } },
    ])
    expect(items.map(item => item.id)).toEqual(["2610.22222", "2610.11111", "2610.33333"])
    expect(items[0]).toMatchObject({ url: "https://huggingface.co/papers/2610.22222", pubDate: "2026-10-14T00:00:00Z", extra: { summary: "Summary two" } })
    expect(items[0].extra?.info).toContain("20")
    expect(items[0].extra?.info).toContain("2026-10-16")
    expect(items[0].extra?.links).toContainEqual({ label: "代码", url: "https://github.com/example/model" })
    expect(items[2].pubDate).toBeUndefined()
  })

  it("does not render malformed entries or unsafe project links", () => {
    const items = parseHuggingFacePapers([{ paper: { id: "2610.11111", title: "Valid", projectPage: "javascript:alert(1)" } }, { paper: { title: "No ID" } }])
    expect(items).toHaveLength(1)
    expect(items[0].extra?.links?.some(link => link.url.startsWith("javascript:"))).toBe(false)
    expect(() => parseHuggingFacePapers({ error: "rate limited" })).toThrow()
  })
})

describe("newsletter and Chinese feeds", () => {
  it("parses RSS summaries as text and retains the actual issue date", () => {
    const items = parseRSSFeed(`<rss><channel><item><title><![CDATA[AI &amp; research]]></title><link>https://example.com/news</link><pubDate>Fri, 16 Oct 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>New <b>model</b></p><script>bad()</script>]]></description></item></channel></rss>`)
    expect(items[0]).toMatchObject({ title: "AI & research", url: "https://example.com/news", pubDate: "Fri, 16 Oct 2026 12:00:00 GMT", extra: { summary: "New model" } })
    expect(() => parseRSSFeed("<html>Access denied</html>")).toThrow()
  })

  it("finds the newest TLDR issue and skips sponsored links in that issue", () => {
    expect(parseTLDRArchive("<a href=\"/ai/2026-10-15\">Old</a><a href=\"/ai/2026-10-16\">New</a><a href=\"/crypto/2026-10-17\">Other</a>")).toBe("https://tldr.tech/ai/2026-10-16")
    const items = parseTLDRIssue(`<article><a href="https://example.com/ad"><h3>Offer (Sponsor)</h3></a><div>Ad</div></article><article><a href="https://example.com/model?utm_source=tldrai"><h3>New model (4 minute read)</h3></a><div class="newsletter-html">A useful model.</div></article>`, "2026-10-16")
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ title: "New model (4 minute read)", url: "https://example.com/model?utm_source=tldrai", pubDate: "2026-10-16", extra: { summary: "A useful model." } })
  })

  it("extracts Batch issues without navigation, duplicates or invented dates", () => {
    const items = parseTheBatch("<a href=\"/the-batch/tag/research\">Research</a><article><a href=\"/the-batch/issue-375\"><h2>Latest AI research</h2></a><time datetime=\"2026-10-14\">Oct 14</time><p>Weekly insights.</p></article><a href=\"/the-batch/issue-375\">Read more</a>")
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ title: "Latest AI research", url: "https://www.deeplearning.ai/the-batch/issue-375", pubDate: "2026-10-14", extra: { summary: "Weekly insights." } })
  })

  it("pairs arXivDaily Chinese titles with the correct original paper", () => {
    const items = parseArxivDaily("<article><a href=\"/papers/2610.12345\">Original title</a><a href=\"/papers/2610.12345\">中文标题</a><p class=\"summary\">中文摘要。</p><a href=\"https://arxiv.org/abs/2610.12345\">URL</a></article>")
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: "2610.12345", title: "中文标题", url: "https://www.arxivdaily.com/papers/2610.12345" })
    expect(items[0].extra?.links).toContainEqual({ label: "论文原文", url: "https://arxiv.org/abs/2610.12345" })
  })

  it("keeps an existing Chinese summary and supplies a fallback for English-only items", async () => {
    const items = await ensureChineseSummaries([
      { id: "zh", title: "中文新闻", url: "https://example.com/zh", extra: { summary: "这是一条中文摘要。" } },
      { id: "en", title: "A new model", url: "https://example.com/en", extra: { summary: "A model improves image reasoning." } },
    ])
    expect(items[0].extra?.summaryZh).toBe("这是一条中文摘要。")
    expect(items[1].extra?.summaryZh).toMatch(/[\u3400-\u9FFF]/)
    expect(items[1].extra?.summaryZh?.length).toBeLessThanOrEqual(180)
  })
})
