import { describe, expect, it } from "vitest"
import { orderHottestSources } from "./source-order"

describe("aI frontier default sources", () => {
  it("puts arXiv and HF first and excludes general news from the AI homepage", () => {
    const original = ["baidu", "qbitai", "huggingface", "arxiv", "tldr-ai", "wallstreetcn-hot"]
    expect(orderHottestSources(original)).toEqual(["arxiv", "huggingface", "tldr-ai", "qbitai"])
    expect(original[0]).toBe("baidu")
  })
  it("does not invent absent sources", () => {
    expect(orderHottestSources(["huggingface", "qbitai"])).toEqual(["huggingface", "qbitai"])
  })
})
