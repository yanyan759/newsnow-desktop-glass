import type { SourceID, SourceResponse } from "@shared/types"
import { isAISource } from "@shared/ai-sources"
import { getCacheTable } from "#/database/cache"
import { ensureChineseSummaries } from "#/utils/ai-summary"

export default defineEventHandler(async (event) => {
  try {
    const { sources: _ }: { sources: SourceID[] } = await readBody(event)
    const cacheTable = await getCacheTable()
    const ids = _?.filter(k => sources[k])
    if (ids?.length && cacheTable) {
      const caches = await cacheTable.getEntire(ids)
      const now = Date.now()
      return await Promise.all(caches.map(async cache => ({
        status: "cache",
        id: cache.id,
        items: isAISource(cache.id) ? await ensureChineseSummaries(cache.items) : cache.items,
        updatedTime: now - cache.updated < sources[cache.id].interval ? now : cache.updated,
      }))) as SourceResponse[]
    }
  } catch {
    //
  }
})
