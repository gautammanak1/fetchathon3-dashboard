import { randomBytes } from "node:crypto"
import QRCode from "qrcode"

export function makeQrToken() {
  return `ft3-${randomBytes(6).toString("hex")}`
}

export function teamQrPayload(input: {
  teamId: string
  venue: string
  token: string
}) {
  return JSON.stringify({
    event: "fetchathon3",
    type: "team_entry",
    team_id: input.teamId,
    venue: input.venue,
    token: input.token,
  })
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
