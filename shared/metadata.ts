import { sources } from "./sources"
import { orderHottestSources } from "./source-order"
import { aiSourceIds } from "./ai-sources"
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "./type.util"
import type { ColumnID, HiddenColumnID, Metadata, SourceID } from "./types"

export const columns = {
  china: {
    zh: "国内",
  },
  world: {
    zh: "国际",
  },
  tech: {
    zh: "科技",
  },
  finance: {
    zh: "财经",
  },
  sports: {
    zh: "体育",
  },
  focus: {
    zh: "关注",
  },
  realtime: {
    zh: "最新动态",
  },
  hottest: {
    zh: "AI 前沿",
  },
  updated: {
    zh: "来源导航",
  },
} as const

export const fixedColumnIds = ["focus", "hottest", "realtime", "updated"] as const satisfies Partial<ColumnID>[]
export const hiddenColumns = Object.keys(columns).filter(id => !fixedColumnIds.includes(id as any)) as HiddenColumnID[]

function getSortedSourceIds(type: "hottest" | "realtime") {
  return typeSafeObjectEntries(sources)
    .filter(([, v]) => v.type === type && !v.redirect)
    .map(([k]) => k)
    .sort((m, n) => m.localeCompare(n))
}

export const metadata: Metadata = typeSafeObjectFromEntries(typeSafeObjectEntries(columns).map(([k, v]) => {
  switch (k) {
    case "focus":
      return [k, {
        name: v.zh,
        sources: [] as SourceID[],
      }]
    case "hottest":
      return [k, {
        name: v.zh,
        sources: orderHottestSources(typeSafeObjectEntries(sources).filter(([, source]) => !source.redirect).map(([id]) => id)),
      }]
    case "realtime":
      return [k, {
        name: v.zh,
        sources: orderHottestSources(getSortedSourceIds("realtime")),
      }]
    case "updated":
      return [k, {
        name: v.zh,
        sources: aiSourceIds.filter(id => sources[id] && !sources[id].redirect),
      }]
    default:
      return [k, {
        name: v.zh,
        sources: typeSafeObjectEntries(sources).filter(([, v]) => v.column === k && !v.redirect).map(([k]) => k),
      }]
  }
}))
