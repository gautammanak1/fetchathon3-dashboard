import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

const DEFAULT_FROM = "innovationlab@fetch.ai"

export type SmtpSettings = {
  host: string
  port: number
  username: string
  password: string
  fromAddr: string
  fromName: string
  timeoutMs: number
}

export function smtpSettings(): SmtpSettings | null {
  const password = (process.env.SMTP_PASSWORD || "").replace(/\s+/g, "")
  if (!password) return null
  const port = Number(process.env.SMTP_PORT || "587")
  if (!Number.isFinite(port)) return null
  const timeoutRaw = Number(process.env.SMTP_TIMEOUT_SECONDS || "20")
  const timeoutMs = (Number.isFinite(timeoutRaw) ? timeoutRaw : 20) * 1000
  return {
    host: (process.env.SMTP_HOST || "smtp.gmail.com").trim() || "smtp.gmail.com",
    port,
    username: (process.env.SMTP_USERNAME || DEFAULT_FROM).trim() || DEFAULT_FROM,
    password,
    fromAddr: (process.env.SMTP_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM,
    fromName: (process.env.SMTP_FROM_NAME || "Fetch-A-Thon").trim() || "Fetch-A-Thon",
    timeoutMs,
  }
}

export function isSmtpConfigured() {
  return smtpSettings() !== null
}

export function createSmtpTransport() {
  const settings = smtpSettings()
  if (!settings) {
    throw new Error("Set SMTP_PASSWORD in .env")
  }
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    connectionTimeout: settings.timeoutMs,
    greetingTimeout: settings.timeoutMs,
    socketTimeout: settings.timeoutMs,
    auth: {
      user: settings.username,
      pass: settings.password,
    },
    pool: true,
    maxConnections: 1,
    maxMessages: Infinity,
  })
}

export async function sendSmtpMail(
  input: {
    to: string
    toName?: string
    cc?: string[]
    subject: string
    text: string
    html: string
    attachments?: Array<{
      filename: string
      content: Buffer
      cid?: string
      contentType?: string
    }>
  },
  transporter?: Transporter,
) {
  const settings = smtpSettings()
  if (!settings) {
    throw new Error("Set SMTP_PASSWORD in .env")
  }
  const owned = !transporter
  const mailer = transporter || createSmtpTransport()
  const cc = [...new Set((input.cc || []).map((email) => email.trim().toLowerCase()))]
    .filter((email) => email && email !== input.to.trim().toLowerCase() && EMAIL_RE.test(email))
  try {
    await mailer.sendMail({
      from: `${settings.fromName} <${settings.fromAddr}>`,
      to: input.toName ? `${input.toName} <${input.to}>` : input.to,
      cc: cc.length ? cc : undefined,
      replyTo: settings.fromAddr,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    })
  } finally {
    if (owned) mailer.close()
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
