export const CERTIFICATE_SHARE_TEXT = [
  "I participated in Fetch-A-Thon 3.0, a community-driven hackathon organized by Fetch.ai.",
  "",
  "@Fetch_ai @fetch_ai_IL",
].join("\n")

export function certificateImagePath(github: string) {
  return `/api/certificate/image?github=${encodeURIComponent(github)}`
}

export function certificatePagePath(github: string) {
  return `/certificate/u/${encodeURIComponent(github)}`
}
