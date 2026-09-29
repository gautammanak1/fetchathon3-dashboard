import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

export const ADMIN_COOKIE = "fetchathon3_admin"
const SESSION_DAYS = 7

function adminEmail() {
  return (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || ""
}

function authSecret() {
  return (
    process.env.AUTH_SECRET ||
    createHash("sha256")
      .update(`fetchathon3:${adminEmail()}:${adminPassword()}`)
      .digest("hex")
  )
}

function digest(value: string) {
  return createHash("sha256").update(value).digest()
}

function safeEqual(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right))
}

export function credentialsConfigured() {
  return Boolean(adminEmail() && adminPassword())
}

export function verifyCredentials(email: string, password: string) {
  if (!credentialsConfigured()) return false
  const emailOk = safeEqual(email.trim().toLowerCase(), adminEmail())
  const passwordOk = safeEqual(password, adminPassword())
  return emailOk && passwordOk
}

export function signSession(email: string) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString("base64url")
  const signature = createHmac("sha256", authSecret())
    .update(payload)
    .digest("base64url")
  return `${payload}.${signature}`
}

export function readSession(token?: string | null) {
  if (!token) return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null
  const expected = createHmac("sha256", authSecret())
    .update(payload)
    .digest("base64url")
  if (!safeEqual(signature, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string
      exp?: number
    }
    if (!data.email || !data.exp || data.exp < Date.now()) return null
    if (!safeEqual(data.email.toLowerCase(), adminEmail())) return null
    return { email: data.email }
  } catch {
    return null
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  }
}

export async function getAdminSession() {
  const store = await cookies()
  return readSession(store.get(ADMIN_COOKIE)?.value)
}
