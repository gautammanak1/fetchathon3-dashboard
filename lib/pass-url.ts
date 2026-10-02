export function appBaseUrl() {
  const configured = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.FETCHATHON_APP_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "")
  if (configured) return configured
  const vercel = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    ""
  ).trim()
  if (vercel) {
    return vercel.startsWith("http") ? vercel.replace(/\/$/, "") : `https://${vercel}`
  }
  return "http://localhost:3000"
}

export function teamPassUrl(token: string) {
  return `${appBaseUrl()}/pass/${encodeURIComponent(token)}`
}

export function isPassToken(token: string) {
  return /^ft3-[a-z0-9-]+$/i.test(token)
}
