import type { SourceID, SourceResponse } from "./types"

export function getCachedSource(cache: Map<SourceID, SourceResponse>, id: SourceID, interval: number, now = Date.now()) {
  const response = cache.get(id)
  if (!response) return
  const timestamp = typeof response.updatedTime === "number" ? response.updatedTime : Date.parse(response.updatedTime)
  const age = now - timestamp
  if (age >= 0 && age < interval) return response
}
