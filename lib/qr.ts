import { createHmac, randomBytes } from "node:crypto"
import QRCode from "qrcode"

import { teamPassUrl } from "@/lib/pass-url"

export function makeQrToken() {
  return `ft3-${randomBytes(6).toString("hex")}`
}

export function deriveTeamQrToken(teamKey: string) {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.QR_SECRET ||
    "fetchathon3-qr"
  return `ft3-${createHmac("sha256", secret)
    .update(`qr:${teamKey}`)
    .digest("hex")
    .slice(0, 12)}`
}

export function teamQrPayload(input: {
  teamId: string
  venue: string
  token: string
}) {
  return teamPassUrl(input.token)
}

export function qrPayload(input: {
  teamId: string
  registrationId: string
  token: string
  name: string
}) {
  return teamQrPayload({
    teamId: input.teamId,
    venue: input.name,
    token: input.token,
  })
}

export async function qrDataUrl(payload: string) {
  return QRCode.toDataURL(payload, {
    margin: 1,
    width: 280,
    color: { dark: "#000000", light: "#ffffff" },
  })
}
