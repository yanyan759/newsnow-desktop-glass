export function orderHottestSources<T extends string>(ids: T[]): T[] {
  const priority = ["36kr-renqi", "github-trending-today", "wallstreetcn-hot"]
  return [
    ...priority.flatMap(id => ids.filter(source => source === id)),
    ...ids.filter(id => !priority.includes(id)),
  ]
}
