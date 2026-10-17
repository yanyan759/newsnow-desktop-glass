import { aiSourceIds } from "./ai-sources"

export function orderHottestSources<T extends string>(ids: T[]): T[] {
  return aiSourceIds.flatMap(id => ids.filter(source => source === id))
}
