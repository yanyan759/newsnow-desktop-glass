import { expect, it, vi } from "vitest"
import source from "../server/sources/nowcoder"
import { myFetch } from "../server/utils/fetch"

vi.mock("../server/utils/fetch", () => ({ myFetch: vi.fn() }))

it("omits unsupported nowcoder entries instead of returning undefined links", async () => {
  vi.mocked(myFetch).mockResolvedValue({ data: { result: [
    { type: 99, id: "bad", uuid: "bad", title: "Unsupported" },
    { type: 74, id: "1", uuid: "feed-one", title: "Feed" },
    { type: 0, id: "2", uuid: "unused", title: "Discussion" },
  ] } })
  expect(await source()).toEqual([
    { id: "feed-one", title: "Feed", url: "https://www.nowcoder.com/feed/main/detail/feed-one" },
    { id: "2", title: "Discussion", url: "https://www.nowcoder.com/discuss/2" },
  ])
})
