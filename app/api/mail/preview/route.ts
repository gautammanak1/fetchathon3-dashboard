import { NextResponse } from "next/server"

import { rejectHtml, rsvpHtml } from "@/lib/email-templates"
import { requireAdmin } from "@/lib/require-admin"
import { rsvpConfirmUrl } from "@/lib/rsvp-confirm"
import type { Registration } from "@/lib/types"

export const dynamic = "force-dynamic"

function sample(city: string): Registration {
  return {
    id: "preview",
    name: "Alex Rivera",
    address: "",
    email: "alex@example.com",
    phone: "",
    role: "Lead",
    team_id: "fetchathon3.0-12",
    team_id_display: "fetchathon3.0-12",
    participation: "team",
    are_you: "Student",
    organization: "Fetch.ai Innovation Lab",
    city: city || "Gurugram",
    metro: city || "Gurugram",
    skills: [],
    experience: "",
    github: "",
    linkedin: "",
    team_size: "1",
    registered_count: "1",
    seats_remaining: "0",
    team_status: "",
    status: "Submitted",
    created_at: new Date().toISOString(),
    registration_mail_status: "none",
    registration_mail_sent_at: null,
    registration_mail_count: 0,
    rsvp_status: "none",
    rsvp_sent_at: null,
    rsvp_count: 0,
    qr_status: "none",
    qr_token: null,
    qr_generated_at: null,
    qr_sent_at: null,
    qr_count: 0,
    reject_status: "none",
    reject_sent_at: null,
    reject_count: 0,
    review_status: "pending",
    property_types: {},
  }
}

export async function GET(request: Request) {
  const denied = await requireAdmin()
  if (denied) return denied
  const url = new URL(request.url)
  const kind = url.searchParams.get("kind") === "reject" ? "reject" : "rsvp"
  const row = sample(url.searchParams.get("city") || "Gurugram")
  const html =
    kind === "reject"
      ? rejectHtml(row)
      : rsvpHtml(row, [row], rsvpConfirmUrl("preview"))
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}
