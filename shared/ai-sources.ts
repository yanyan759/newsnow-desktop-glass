export const aiSourceIds = [
  "arxiv",
  "huggingface",
  "tldr-ai",
  "qbitai",
  "arxivdaily",
  "the-batch",
  "import-ai",
  "ai-channels",
] as const

export const aiRefreshInterval = 15 * 60 * 1000
const aiSourceSet = new Set<string>(aiSourceIds)

export function isAISource(id: string) {
  return aiSourceSet.has(id)
}
