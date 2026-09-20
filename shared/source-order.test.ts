import { describe, expect, it } from "vitest"
import { orderHottestSources } from "./source-order"

describe("desktop requested hottest order", () => {
  it("places GitHub second and Wallstreet third without losing other sources", () => {
    const original = ["36kr-renqi", "baidu", "bilibili-hot", "github-trending-today", "wallstreetcn-hot", "zhihu"]
    expect(orderHottestSources(original)).toEqual(["36kr-renqi", "github-trending-today", "wallstreetcn-hot", "baidu", "bilibili-hot", "zhihu"])
    expect(original[1]).toBe("baidu")
  })
  it("does not invent absent sources", () => {
    expect(orderHottestSources(["baidu", "zhihu"])).toEqual(["baidu", "zhihu"])
  })
})
