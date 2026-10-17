import { describe, expect, it } from "vitest"
import type { SourceID, SourceResponse } from "../shared/types"
import { getCachedSource } from "../shared/source-cache"

describe("source cache expiry", () => {
  const response = { id: "arxiv", status: "success", updatedTime: "2026-10-17T00:00:00Z", items: [{ id: "one", title: "Paper", url: "https://arxiv.org/abs/2610.12345" }] } as SourceResponse
  it("reuses a recent response but retrieves again at the source refresh interval", () => {
    const cache = new Map([[response.id, response]])
    expect(getCachedSource(cache, response.id, 30 * 60_000, Date.parse("2026-10-17T00:15:00Z"))).toBe(response)
    expect(getCachedSource(cache, response.id, 30 * 60_000, Date.parse("2026-10-17T00:30:00Z"))).toBeUndefined()
  })
  it("does not permanently reuse an invalid timestamp or a future-dated response", () => {
    const cache = new Map<SourceID, SourceResponse>([[response.id, { ...response, updatedTime: "invalid" }]])
    expect(getCachedSource(cache, response.id, 30_000, 60_000)).toBeUndefined()
    cache.set(response.id, { ...response, updatedTime: 90_000 })
    expect(getCachedSource(cache, response.id, 30_000, 60_000)).toBeUndefined()
  })
})
