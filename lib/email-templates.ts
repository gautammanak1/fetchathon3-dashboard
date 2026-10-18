import {
  DISCORD_NOTE,
  DOCS_URL,
  EVENT_DATE,
  EXAMPLES_URL,
  HACKPACK_URL,
  OFFER_CODE,
  PRIZES,
  mailVenue,
} from "@/lib/event-venues"
import { rsvpPlainMessage } from "@/lib/rsvp-templates"
import type { Registration } from "@/lib/types"

const DEFAULT_BANNER =
  "https://res.cloudinary.com/fetch-ai/image/upload/v1790604758/golden-agents/X_4_tswsoe.png"
const DEFAULT_EVENT_URL = "https://innovationlab.fetch.ai/events/fetch-a-thon-3"
const FONT = "Segoe UI,Arial,Helvetica,sans-serif"
const URL_RE = /^https?:\/\//i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function eventPageUrl() {
  return (
    (process.env.FETCHATHON_EVENT_URL || DEFAULT_EVENT_URL).trim() ||
    DEFAULT_EVENT_URL
  )
}

export function bannerUrl() {
  const configured = (process.env.FETCHATHON_EMAIL_BANNER_URL || DEFAULT_BANNER).trim()
  return URL_RE.test(configured) ? configured : DEFAULT_BANNER
}

export function discordInviteUrl() {
  const configured = (process.env.FETCHATHON_DISCORD_URL || "https://discord.gg/fetchai").trim()
  return URL_RE.test(configured) ? configured : "https://discord.gg/fetchai"
}

function ctaButtonsHtml() {
  const eventUrl = escapeHtml(eventPageUrl())
  const discordUrl = escapeHtml(discordInviteUrl())
  return `
          <tr>
            <td style="padding:28px 36px 0;font-family:${FONT};">
              <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#4a4663;">Next steps</p>
              <a href="${eventUrl}" style="display:inline-block;background:#241b5e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;line-height:1;padding:14px 18px;">Open event page</a>
              <a href="${discordUrl}" style="display:inline-block;margin-left:10px;background:#5865f2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;line-height:1;padding:14px 18px;">Join Discord</a>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#4a4663;">
                Join the Fetch.ai Discord so you get event updates:
                <a href="${discordUrl}" style="color:#3d2db8;text-decoration:underline;">${discordUrl}</a>
              </p>
            </td>
          </tr>`
}

function participationMode(row: Registration) {
  const participation = clean(row.participation).toLowerCase()
  const role = clean(row.role).toLowerCase()
  const size = Number(row.team_size)
  if (participation === "solo" || (role !== "member" && size === 1)) {
    return "solo" as const
  }
  return "team" as const
}

function detailRows(row: Registration) {
  const role = clean(row.role)
  const rows: Array<[string, string]> = [
    ["Full name", clean(row.name)],
    ["Role", role ? role.replace(/^\w/, (c) => c.toUpperCase()) : ""],
    ["Email", clean(row.email)],
    ["Phone", clean(row.phone)],
    ["Are you", clean(row.are_you)],
    ["College / Company", clean(row.organization)],
    ["Location", clean(row.city)],
    ["Experience", clean(row.experience)],
    ["GitHub", clean(row.github)],
    ["LinkedIn", clean(row.linkedin)],
    ["Team ID", clean(row.team_id_display)],
  ]
  const size = Number(row.team_size)
  if (participationMode(row) === "team" && Number.isFinite(size) && size > 0) {
    rows.push(["Team size", String(size)])
  }
  if (clean(row.team_status)) {
    rows.push(["Team status", clean(row.team_status)])
  }
  return rows.filter(([, value]) => value)
}

function linkify(value: string) {
  const escaped = escapeHtml(value)
  if (URL_RE.test(value)) {
    return `<a href="${escaped}" style="color:#4c3ad4;text-decoration:underline;" target="_blank">${escaped}</a>`
  }
  if (EMAIL_RE.test(value)) {
    return `<a href="mailto:${escaped}" style="color:#4c3ad4;text-decoration:underline;">${escaped}</a>`
  }
  return escaped
}

function detailValueHtml(label: string, value: string) {
  if (label === "Team ID") {
    const escaped = escapeHtml(value)
    return (
      `<span style="display:inline-block;background:#f3f0ff;color:#3d2db8;` +
      `font-family:Consolas,Menlo,monospace;font-size:14px;font-weight:700;` +
      `letter-spacing:0.02em;padding:4px 8px;">${escaped}</span>`
    )
  }
  return linkify(value)
}

function bannerHtml() {
  const src = escapeHtml(bannerUrl())
  return (
    `<tr><td style="padding:0;line-height:0;font-size:0;background:#f7f4ff;">` +
    `<img src="${src}" width="600" alt="Fetch-A-Thon 3.0" ` +
    `style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;">` +
    `</td></tr>`
  )
}

function wrapEmail(title: string, inner: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin:0; padding:0; width:100% !important; }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; max-width:100%; height:auto; }
    a { word-break:break-word; }
    @media only screen and (max-width:600px) {
      .shell { width:100% !important; }
      .pad { padding-left:16px !important; padding-right:16px !important; }
      .hero { font-size:24px !important; }
      .mark { font-size:34px !important; }
      .greet { font-size:24px !important; }
    }
    @media only screen and (max-width:420px) {
      .btncol { display:block !important; width:100% !important; max-width:100% !important; }
      .btnspace { padding:0 0 10px 0 !important; }
      .labelcol { display:block !important; width:100% !important; padding:10px 12px 0 12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#efeafc;width:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efeafc;margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:12px 8px;">
        <table role="presentation" class="shell" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:24px;">
          ${bannerHtml()}
          ${inner}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function detailsTableHtml(row: Registration) {
  const rows = detailRows(row)
  const rowsHtml = rows.map(([label, value], index) => {
    const border = index < rows.length - 1 ? "border-bottom:1px solid #eeeaf6;" : ""
    return (
      `<tr>` +
      `<td style="padding:14px 0;${border}width:148px;vertical-align:top;` +
      `font-family:${FONT};font-size:13px;line-height:1.4;color:#8a849e;">${escapeHtml(label)}</td>` +
      `<td style="padding:14px 0 14px 12px;${border}vertical-align:top;` +
      `font-family:${FONT};font-size:15px;line-height:1.45;color:#1a1740;">` +
      `${detailValueHtml(label, value)}</td>` +
      `</tr>`
    )
  })
  return rowsHtml.join("")
}

export function registrationSubject() {
  return "Thank you for registering for Fetch-A-Thon 3.0"
}

function registrationBlurb(row: Registration) {
  const mode = participationMode(row)
  const role = clean(row.role).toLowerCase()
  const teamId = row.team_id_display
  const size = Number(row.team_size)
  if (mode === "solo") {
    return {
      label: "Solo",
      blurb: "You registered as a solo participant. We will review your profile on its own.",
    }
  }
  if (role === "lead") {
    const sizeBit = Number.isFinite(size) && size > 0
      ? ` Your team size is ${size}, including you.`
      : ""
    const share = teamId
      ? ` Share Team ID ${teamId} with your teammates so they can register and complete the team.`
      : ""
    return {
      label: "Team",
      blurb: `You registered as the team lead.${sizeBit}${share}`,
    }
  }
  const joined = teamId ? ` You joined Team ID ${teamId}.` : ""
  return {
    label: "Team",
    blurb: `You registered as a team member.${joined}`,
  }
}

export function registrationText(row: Registration) {
  const name = clean(row.name) || "there"
  const { label, blurb } = registrationBlurb(row)
  const lines = [
    `Hi ${name}!`,
    "",
    "Thank you for registering for Fetch-A-Thon 3.0.",
    "We have saved your response and will review your profile.",
    "We will let you know if you are shortlisted.",
    "",
    `Participation: ${label}`,
    blurb,
    "",
    "Your registration details",
  ]
  for (const [field, value] of detailRows(row)) {
    lines.push(`- ${field}: ${value}`)
  }
  lines.push(
    "",
    `Event page: ${eventPageUrl()}`,
    `Join Discord: ${discordInviteUrl()}`,
    "",
    "For any queries, email innovationlab@fetch.ai and the Innovation Lab team will get back to you.",
    "",
    "Please note that filling this form does not guarantee a seat or a slot at the event. The organizers will send you a unique Entry Pass or communicate personally with you if you have been shortlisted.",
    "",
    "Fetch.ai Innovation Lab",
  )
  return lines.join("\n")
}

export function registrationHtml(row: Registration) {
  const name = escapeHtml(clean(row.name) || "there")
  const { label, blurb } = registrationBlurb(row)
  const inner = `
          <tr>
            <td style="padding:32px 36px 0;font-family:${FONT};color:#1a1740;">
              <p style="margin:0;font-size:26px;line-height:1.25;font-weight:700;">Hi ${name}!</p>
              <p style="margin:14px 0 0;font-size:16px;line-height:1.65;color:#3d3958;">
                Thank you for registering for Fetch-A-Thon 3.0. We have saved your response and will review your profile.
              </p>
              <p style="margin:8px 0 0;font-size:16px;line-height:1.65;color:#3d3958;">
                We will let you know if you are shortlisted.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="4" style="width:4px;background:#5b45f5;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:2px 0 2px 16px;font-family:${FONT};">
                    <p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.14em;text-transform:uppercase;color:#8a849e;">Registered as</p>
                    <p style="margin:6px 0 0;font-size:22px;line-height:1.2;font-weight:700;color:#2a1f8f;">${escapeHtml(label)}</p>
                    <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#4a4663;">${escapeHtml(blurb)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 0;font-family:${FONT};">
              <p style="margin:0 0 4px;padding-bottom:8px;border-bottom:1px solid #ece8f5;font-size:12px;line-height:1.4;letter-spacing:0.14em;text-transform:uppercase;color:#8a849e;">Your details</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${detailsTableHtml(row)}
              </table>
            </td>
          </tr>
          ${ctaButtonsHtml()}
          <tr>
            <td style="padding:28px 36px 0;font-family:${FONT};font-size:14px;line-height:1.65;color:#4a4663;">
              For any queries, email
              <a href="mailto:innovationlab@fetch.ai" style="color:#3d2db8;text-decoration:underline;">innovationlab@fetch.ai</a>
              and the Innovation Lab team will get back to you.
            </td>
          </tr>
          <tr>
            <td style="padding:24px 36px 32px;font-family:${FONT};">
              <p style="margin:0;padding-top:18px;border-top:1px solid #ece8f5;font-size:12px;line-height:1.6;color:#8a849e;">
                Filling this form does not guarantee a seat or a slot at the event. The organizers will send a unique Entry Pass, or write to you directly, if you are shortlisted.
              </p>
              <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#8a849e;">Fetch.ai Innovation Lab</p>
            </td>
          </tr>`
  return wrapEmail(registrationSubject(), inner)
}

export function rejectSubject() {
  return "See you at Fetch-A-Thon 4.0"
}

export function rejectText(row: Registration) {
  const name = clean(row.name) || "there"
  return [
    `Hi ${name},`,
    "",
    "Thank you for registering for Fetch-A-Thon 3.0.",
    "",
    "We could not offer you a seat this time. We hope to see you next time at Fetch-A-Thon 4.0.",
    "",
    "Regards,",
    "Fetch.ai Innovation Lab",
    "",
    "Thank you",
  ].join("\n")
}

export function rejectHtml(row: Registration) {
  const name = clean(row.name) || "there"
  const inner = `<tr><td class="pad" style="padding:28px 28px 8px;font-family:${FONT};color:#1a1a1a;">
    <p style="margin:0;font-size:16px;line-height:1.5;">Hi ${escapeHtml(name)},</p>
    <p style="margin:16px 0 0;font-size:16px;line-height:1.55;">Thank you for registering for <strong>Fetch-A-Thon 3.0</strong>.</p>
    <p style="margin:16px 0 0;font-size:16px;line-height:1.55;">We could not offer you a seat this time. We hope to see you next time at <strong>Fetch-A-Thon 4.0</strong>.</p>
    <p style="margin:22px 0 0;font-size:15px;line-height:1.5;color:#222;">Regards,</p>
    <p style="margin:4px 0 0;font-size:15px;line-height:1.5;font-weight:700;color:#222;">Fetch.ai Innovation Lab</p>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.5;color:#222;">Thank you</p>
  </td></tr>`
  return wrapEmail(rejectSubject(), `${inner}${mailFooter()}`)
}

export function rsvpSubject(venueLabel = "") {
  return venueLabel
    ? `You're selected for Fetch-A-Thon 3.0 — ${venueLabel}`
    : "You're selected for Fetch-A-Thon 3.0 — please confirm"
}

function personName(row: Registration) {
  return clean(row.name)
}

function teamGreeting(row: Registration, members: Registration[]) {
  const names = (members.length > 1 ? members : [row])
    .map((member) => personName(member))
    .filter(Boolean)
  if (names.length === 0) return "Hi,"
  if (names.length === 1) return `Hi ${names[0]} 🎉`
  if (names.length === 2) return `Hi ${names[0]} and ${names[1]} 🎉`
  return `Hi ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]} 🎉`
}

function membersListText(members: Registration[]) {
  return members.map((member) => {
    const bits = [clean(member.name) || "Untitled", clean(member.role), clean(member.email)]
      .filter(Boolean)
    return `- ${bits.join(" · ")}`
  })
}

function mailButton(href: string, label: string, color = "#5b45f5") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${color}" style="border-radius:999px;background:${color};"><a href="${escapeHtml(href)}" style="display:block;padding:14px 18px;font-family:${FONT};font-size:15px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a></td></tr></table>`
}

function softCard(inner: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ff;border-radius:18px;"><tr><td style="padding:16px;font-family:${FONT};">${inner}</td></tr></table>`
}

function sectionGap() {
  return `<tr><td style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>`
}

export function rsvpText(
  row: Registration,
  members: Registration[] = [row],
  confirmUrl = "",
) {
  const venue = mailVenue(row.city, row.metro)
  const teamLines = [
    members.length > 1 ? "Team" : "Your registration",
    ...membersListText(members),
    `Team ID: ${clean(row.team_id_display) || "Solo"}`,
    `Venue: ${venue.label}`,
  ]
  return rsvpPlainMessage({
    greeting: teamGreeting(row, members),
    venue,
    confirmUrl,
    discordUrl: discordInviteUrl(),
    teamLines,
  })
}

function eyebrow(text: string) {
  return `<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.14em;text-transform:uppercase;color:#7a7598;font-family:${FONT};">${escapeHtml(text)}</p>`
}

function bodyCopy(text: string) {
  return `<p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#2c2750;font-family:${FONT};">${escapeHtml(text)}</p>`
}

function prizeStack(items: Array<[string, string, string]> = PRIZES) {
  return items
    .map(
      ([title, amount, detail]) => `<tr><td style="padding:0 0 8px;">${softCard(
        `${eyebrow(title)}<p style="margin:6px 0 0;font-size:20px;line-height:1.2;font-weight:800;color:#5b45f5;font-family:${FONT};">${escapeHtml(amount)}</p><p style="margin:4px 0 0;font-size:14px;line-height:1.45;color:#3d3958;font-family:${FONT};">${escapeHtml(detail)}</p>`,
      )}</td></tr>`,
    )
    .join("")
}

function brandedRows(rows: string) {
  return `<tr><td class="pad" style="padding:20px 20px 8px;font-family:${FONT};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>`
}

function mailFooter() {
  return `<tr><td style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>`
}

function laterUrl(confirmUrl: string) {
  if (!confirmUrl) return ""
  return confirmUrl.includes("?") ? `${confirmUrl}&later=1` : `${confirmUrl}?later=1`
}

function choiceButton(href: string, label: string, color: string) {
  return `<a href="${escapeHtml(href)}" style="display:block;padding:22px 8px;font-family:${FONT};font-size:16px;line-height:1.25;font-weight:700;color:#ffffff;text-decoration:none;text-align:center;border-radius:8px;background:${color};">${label}</a>`
}

function rsvpChoiceButtons(confirmUrl: string) {
  if (!confirmUrl) return ""
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td class="btncol btnspace" width="50%" valign="top" style="width:50%;padding:0 8px 0 0;">
        ${choiceButton(confirmUrl, "&#10003;&nbsp; Absolutely, I'm In!", "#2ebd4f")}
      </td>
      <td class="btncol" width="50%" valign="top" style="width:50%;padding:0 0 0 8px;">
        ${choiceButton(laterUrl(confirmUrl), "Next Time, May Be", "#d39a9a")}
      </td>
    </tr>
  </table>`
}

function eventDateBox() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e6e6;border-radius:8px;">
    <tr>
      <td width="56" valign="middle" style="width:56px;padding:12px 0 12px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid #f3c1c1;border-radius:6px;">
          <tr><td align="center" style="background:#fdecec;color:#e23b3b;font-family:${FONT};font-size:9px;font-weight:700;letter-spacing:0.04em;padding:2px 6px;">OCT</td></tr>
          <tr><td align="center" style="font-family:${FONT};font-size:16px;font-weight:700;color:#222;padding:2px 6px 4px;">24</td></tr>
        </table>
      </td>
      <td valign="middle" style="padding:12px;font-family:${FONT};font-size:16px;line-height:1.4;color:#222;">Saturday, ${escapeHtml(EVENT_DATE)}</td>
    </tr>
  </table>`
}

function messageBox(inner: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed #d5d5d5;border-radius:8px;">
    <tr><td style="padding:4px 0;">${inner}</td></tr>
  </table>`
}

function textLink(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" style="color:#2457d6;text-decoration:underline;word-break:break-all;">${escapeHtml(label)}</a>`
}

function fitRow(label: string, value: string, last = false) {
  const border = last ? "" : "border-bottom:1px solid #ececec;"
  return `<tr>
    <td class="labelcol" width="112" valign="top" style="width:112px;padding:10px 8px 10px 12px;${border}font-family:${FONT};font-size:13px;line-height:1.4;color:#6b6b6b;">${escapeHtml(label)}</td>
    <td valign="top" style="padding:10px 12px 10px 0;${border}font-family:${FONT};font-size:14px;line-height:1.45;color:#222;word-break:break-word;">${value}</td>
  </tr>`
}

function fitTable(rows: Array<[string, string]>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    ${rows.map(([label, value], index) => fitRow(label, value, index === rows.length - 1)).join("")}
  </table>`
}

function prizeFitTable(items: Array<[string, string, string]> = PRIZES) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid #ececec;">
    <tr>
      <td colspan="2" style="padding:12px 12px 4px;font-family:${FONT};font-size:13px;font-weight:700;color:#111;">Prizes</td>
    </tr>
    ${items.map(([title, amount, detail]) => `<tr>
      <td valign="top" style="padding:8px 8px 8px 12px;border-top:1px solid #f2f2f2;font-family:${FONT};font-size:14px;line-height:1.4;color:#222;">${escapeHtml(title)}<br><span style="font-size:12px;line-height:1.4;color:#6b6b6b;">${escapeHtml(detail)}</span></td>
      <td class="amt" width="92" valign="top" align="right" style="width:92px;padding:8px 12px 8px 8px;border-top:1px solid #f2f2f2;font-family:${FONT};font-size:14px;line-height:1.4;font-weight:700;color:#222;white-space:nowrap;">${escapeHtml(amount)}</td>
    </tr>`).join("")}
  </table>`
}

function rsvpShell(greeting: string, confirmUrl: string, message: string) {
  const hello = greeting.trim() || "Hi 🎉"
  return `<tr><td class="pad" style="padding:28px 28px 8px;font-family:${FONT};color:#1a1a1a;">
    <p style="margin:0;font-size:16px;line-height:1.5;">${escapeHtml(hello)}</p>
    <p style="margin:16px 0 0;font-size:16px;line-height:1.55;">Congratulations! You're shortlisted for <strong>Fetch-A-Thon 3.0</strong>. Please <span style="background:#fff3a0;">confirm</span> your RSVP below.</p>
    <p style="margin:28px 0 16px;font-size:32px;line-height:1.15;font-weight:500;color:#111;">Fetch-A-Thon 3.0</p>
    ${eventDateBox()}
    <p style="margin:22px 0 12px;font-size:18px;line-height:1.3;font-weight:700;">Will You Be Joining Us?</p>
    ${rsvpChoiceButtons(confirmUrl)}
    <p style="margin:22px 0;border-top:1px solid #ececec;font-size:0;line-height:0;">&nbsp;</p>
    <p style="margin:0 0 14px;font-size:18px;line-height:1.3;font-weight:700;text-align:center;">The Organizers have included a message</p>
    ${messageBox(message)}
    <p style="margin:22px 0 0;font-size:15px;line-height:1.5;color:#222;">Regards,</p>
    <p style="margin:4px 0 0;font-size:15px;line-height:1.5;font-weight:700;color:#222;">Fetch.ai Innovation Lab</p>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.5;color:#222;">Thank you</p>
  </td></tr>`
}

export function rsvpHtml(
  row: Registration,
  members: Registration[] = [row],
  confirmUrl = "",
) {
  const venue = mailVenue(row.city, row.metro)
  const note = venue.note && venue.note !== "This is your location." ? venue.note : ""
  const people = members
    .map((member) => [clean(member.name), clean(member.role)].filter(Boolean).join(" · "))
    .filter(Boolean)
  const rows: Array<[string, string]> = [
    ["Location", `${escapeHtml(venue.label)}${note ? `<br><span style="color:#6b6b6b;">${escapeHtml(note)}</span>` : ""}`],
  ]
  if (venue.mapUrl) rows.push(["Map", textLink(venue.mapUrl, "Open map")])
  rows.push(
    ["Discord", `${escapeHtml(DISCORD_NOTE)}<br>${textLink(discordInviteUrl(), "Join Discord")}`],
    ["Offer", "One month free ASI:One Pro and Agentverse Premium."],
    ["Code", `<strong style="letter-spacing:0.04em;">${OFFER_CODE}</strong>`],
    ["Hackpack", textLink(HACKPACK_URL, "Open hackpack")],
    ["Examples", textLink(EXAMPLES_URL, "GitHub examples")],
    ["Docs", textLink(DOCS_URL, "Innovation Lab docs")],
    ["Team", people.length ? people.map((person) => escapeHtml(person)).join("<br>") : escapeHtml(personName(row))],
    ["Team ID", escapeHtml(clean(row.team_id_display) || "Solo")],
  )
  const message = `${fitTable(rows)}${prizeFitTable()}`
  return wrapEmail(rsvpSubject(venue.label), `${rsvpShell(teamGreeting(row, members), confirmUrl, message)}${mailFooter()}`)
}

export function qrSubject(teamIdDisplay: string) {
  return teamIdDisplay
    ? `Your Fetch-A-Thon 3.0 venue QR for ${teamIdDisplay}`
    : "Your Fetch-A-Thon 3.0 venue QR"
}

export function qrText(input: {
  row: Registration
  teamIdDisplay: string
  venue: string
  memberNames: string[]
}) {
  const name = clean(input.row.name)
  return [
    name ? `Hi ${name},` : "Hi,",
    "",
    "Your team venue QR for Fetch-A-Thon 3.0 is ready.",
    "One QR is used for the whole team. Scanning it opens your team pass with names and venue.",
    "Show this at the venue check-in desk.",
    "",
    `Team ID: ${input.teamIdDisplay || "Solo"}`,
    `Venue: ${input.venue || "See event page"}`,
    input.memberNames.length
      ? `Team: ${input.memberNames.join(", ")}`
      : "",
    "",
    `Event page: ${eventPageUrl()}`,
    DISCORD_NOTE,
    discordInviteUrl(),
    "",
    "Fetch.ai Innovation Lab",
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n")
}

export function qrHtml(input: {
  row: Registration
  teamIdDisplay: string
  venue: string
  memberNames: string[]
}) {
  const who = clean(input.row.name)
  const name = escapeHtml(who ? `Hi ${who},` : "Hi,")
  const teamId = escapeHtml(input.teamIdDisplay || "Solo")
  const venue = escapeHtml(input.venue || "See event page")
  const members = escapeHtml(input.memberNames.join(", ") || clean(input.row.name))
  const inner = `
          <tr>
            <td style="padding:32px 36px 0;font-family:${FONT};color:#1a1740;">
              <p style="margin:0;font-size:26px;line-height:1.25;font-weight:700;">${name}</p>
              <p style="margin:14px 0 0;font-size:16px;line-height:1.65;color:#3d3958;">
                Your team venue QR for Fetch-A-Thon 3.0 is ready. One QR is used for the whole team. Scanning it opens your team pass.
              </p>
              <p style="margin:8px 0 0;font-size:16px;line-height:1.65;color:#3d3958;">
                Show this QR at the venue check-in desk.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="4" style="width:4px;background:#5b45f5;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:2px 0 2px 16px;font-family:${FONT};">
                    <p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.14em;text-transform:uppercase;color:#8a849e;">Venue entry pass</p>
                    <p style="margin:6px 0 0;font-size:22px;line-height:1.2;font-weight:700;color:#2a1f8f;">${teamId}</p>
                    <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#4a4663;">Venue: ${venue}</p>
                    <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#4a4663;">Team: ${members}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 36px 0;">
              <img src="cid:teamqr" width="240" alt="Team venue QR" style="display:block;width:240px;height:240px;border:0;background:#ffffff;">
            </td>
          </tr>
          ${ctaButtonsHtml()}
          <tr>
            <td style="padding:24px 36px 32px;font-family:${FONT};">
              <p style="margin:0;padding-top:18px;border-top:1px solid #ece8f5;font-size:12px;line-height:1.6;color:#8a849e;">
                This QR is shared by the whole team. Anyone on the team can show it at the venue.
              </p>
              <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#8a849e;">Fetch.ai Innovation Lab</p>
            </td>
          </tr>`
  return wrapEmail(qrSubject(input.teamIdDisplay), inner)
}

const PRIZE_LINE = /^(.+?):\s*(₹[\d,]+)\s*[—–-]\s*(.+)$/
const LINK_LINE = /^(.+?):\s*(https?:\/\/\S+)\s*$/i

function firstUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s<>]+/i)
  return match ? match[0].replace(/[),.;]+$/, "") : ""
}

function composeBlock(block: string) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return ""
  const greeting = lines.length === 1 ? lines[0].match(/^Hi\s+(.+?)[,!]?\s*$/i) : null
  if (greeting) {
    const name = greeting[1].trim()
    const line = !name || name.toLowerCase() === "there" ? "Hi," : `Hi ${name},`
    return `<tr><td class="greet" style="padding:0 0 10px;font-family:${FONT};font-size:28px;line-height:1.2;font-weight:800;color:#1a1548;">${escapeHtml(line)}</td></tr>`
  }
  if (/^for any queries/i.test(lines[0])) return ""
  if (/^fetch-a-thon\b/i.test(lines[0]) || /^fetch\.ai innovation lab$/i.test(lines[0])) return ""
  if (/^confirm your seat:/i.test(lines[0])) {
    const href = firstUrl(block)
    if (!href) return ""
    return `<tr><td>${mailButton(href, "Confirm my seat")}</td></tr>`
  }
  if (/this is your location/i.test(lines[0])) {
    const label = lines[0].replace(/^this is your location:\s*/i, "").trim() || "Your venue"
    const note = lines.slice(1).filter((line) => !firstUrl(line)).join(" ")
    const href = firstUrl(block)
    const map = href
      ? `<div style="height:12px;font-size:0;line-height:0;">&nbsp;</div>${mailButton(href, "Open your location")}`
      : ""
    return `<tr><td>${softCard(
      `${eyebrow("This is your location")}<p style="margin:6px 0 0;font-size:22px;line-height:1.25;font-weight:800;color:#1a1548;font-family:${FONT};">${escapeHtml(label)}</p>${note ? bodyCopy(note) : ""}${map}`,
    )}</td></tr>`
  }
  if (/^exclusive offer$/i.test(lines[0])) {
    const codeLine = lines.find((line) => /^use code:/i.test(line))
    const code = codeLine ? codeLine.replace(/^use code:\s*/i, "").trim() : OFFER_CODE
    const copy = lines.filter((line, index) => index > 0 && line !== codeLine).join(" ")
    return `<tr><td>${softCard(
      `${eyebrow("Exclusive offer")}${copy ? bodyCopy(copy) : ""}${code ? `<p style="margin:12px 0 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#7a7598;font-family:${FONT};">Use code</p><p style="margin:4px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:0.12em;color:#5b45f5;">${escapeHtml(code)}</p>` : ""}`,
    )}</td></tr>`
  }
  if (/^hackpack:/i.test(lines[0])) {
    const href = firstUrl(lines[0])
    if (!href) return ""
    return `<tr><td>${mailButton(href, "Open the hackpack")}</td></tr>`
  }
  if (/discord/i.test(block) && firstUrl(block)) {
    return `<tr><td style="padding:0 0 8px;font-family:${FONT};font-size:15px;line-height:1.55;color:#2c2750;">${escapeHtml(DISCORD_NOTE)}</td></tr><tr><td>${mailButton(firstUrl(block), "Join Discord", "#5865f2")}</td></tr>`
  }
  if (/^prizes$/i.test(lines[0])) {
    const items = lines.slice(1).map((line) => {
      const match = line.match(PRIZE_LINE)
      return match ? [match[1].trim(), match[2].trim(), match[3].trim()] as [string, string, string] : null
    }).filter((item): item is [string, string, string] => Boolean(item))
    if (items.length === 0) return ""
    return `<tr><td style="padding:0 0 8px;">${eyebrow("Prizes")}</td></tr>${prizeStack(items)}`
  }
  if (/^start here$/i.test(lines[0])) {
    const links = lines.slice(1).map((line) => {
      const match = line.match(LINK_LINE)
      return match ? `<p style="margin:8px 0 0;font-size:15px;line-height:1.6;font-family:${FONT};"><a href="${escapeHtml(match[2])}" style="color:#5b45f5;text-decoration:underline;">${escapeHtml(match[1])}</a></p>` : ""
    }).join("")
    if (!links) return ""
    return `<tr><td>${softCard(`${eyebrow("Start building")}${links}`)}</td></tr>`
  }
  if (lines.every((line) => /^(team|venue)\s*:/i.test(line))) {
    const copy = lines
      .map((line) => {
        const [label, ...rest] = line.split(":")
        return `<p style="margin:6px 0 0;font-size:15px;line-height:1.5;color:#2c2750;font-family:${FONT};"><span style="color:#7a7598;">${escapeHtml(label.trim())}</span> ${escapeHtml(rest.join(":").trim())}</p>`
      })
      .join("")
    return `<tr><td>${softCard(`${eyebrow("Your details")}${copy}`)}</td></tr>`
  }
  return `<tr><td style="padding:0;font-family:${FONT};font-size:16px;line-height:1.6;color:#2c2750;">${escapeHtml(lines.join("\n")).replace(/\n/g, "<br>")}</td></tr>`
}

function rsvpFromCompose(subject: string, body: string) {
  const blocks = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  let greeting = "Hi 🎉"
  let confirmUrl = ""
  const rows: Array<[string, string]> = []
  let prizes: Array<[string, string, string]> = []
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
    const hi = lines.length === 1 ? lines[0].match(/^Hi\s+(.+)$/i) : null
    if (hi) {
      const name = hi[1].replace(/[🎉,!\s]+$/g, "").trim()
      greeting = !name || name.toLowerCase() === "there" ? "Hi 🎉" : `Hi ${name} 🎉`
      continue
    }
    if (/^saturday,/i.test(lines[0]) || /^congratulations!/i.test(lines[0])) continue
    if (/absolutely, i'm in:|confirm your seat:/i.test(lines[0])) {
      confirmUrl = firstUrl(block).replace(/[?&]later=1\b/, "").replace(/[?&]$/, "")
      continue
    }
    if (/^next time, maybe:/i.test(lines[0])) continue
    if (/^for any queries/i.test(lines[0]) || /^fetch-a-thon\b/i.test(lines[0]) || /^fetch\.ai innovation lab$/i.test(lines[0]) || /^regards,?$/i.test(lines[0]) || /^thank you\.?$/i.test(lines[0])) continue
    if (/this is your location/i.test(lines[0])) {
      const label = lines[0].replace(/^this is your location:\s*/i, "").trim()
      const note = lines.slice(1).filter((line) => !firstUrl(line)).join(" ")
      rows.push(["Location", `${escapeHtml(label)}${note ? `<br><span style="color:#6b6b6b;">${escapeHtml(note)}</span>` : ""}`])
      const href = firstUrl(block)
      if (href) rows.push(["Map", textLink(href, "Open map")])
      continue
    }
    if (/discord/i.test(block)) {
      const href = firstUrl(block)
      rows.push(["Discord", `${escapeHtml(DISCORD_NOTE)}${href ? `<br>${textLink(href, "Join Discord")}` : ""}`])
      continue
    }
    if (/^exclusive offer$/i.test(lines[0])) {
      const codeLine = lines.find((line) => /^use code:/i.test(line))
      const code = codeLine ? codeLine.replace(/^use code:\s*/i, "").trim() : OFFER_CODE
      const copy = lines.filter((line, index) => index > 0 && line !== codeLine).join(" ")
      if (copy) rows.push(["Offer", escapeHtml(copy)])
      if (code) rows.push(["Code", `<strong style="letter-spacing:0.04em;">${escapeHtml(code)}</strong>`])
      continue
    }
    if (/^hackpack:/i.test(lines[0])) {
      const href = firstUrl(lines[0])
      if (href) rows.push(["Hackpack", textLink(href, "Open hackpack")])
      continue
    }
    if (/^prizes$/i.test(lines[0])) {
      prizes = lines.slice(1).flatMap((line) => {
        const match = line.match(PRIZE_LINE)
        return match ? [[match[1].trim(), match[2].trim(), match[3].trim()] as [string, string, string]] : []
      })
      continue
    }
    if (/^start here$/i.test(lines[0])) {
      for (const line of lines.slice(1)) {
        const match = line.match(LINK_LINE)
        if (!match) continue
        const label = /example/i.test(match[1]) ? "Examples" : /doc/i.test(match[1]) ? "Docs" : match[1]
        rows.push([label, textLink(match[2], match[1])])
      }
      continue
    }
    if (lines.every((line) => /^(team|venue)\s*:/i.test(line))) {
      for (const line of lines) {
        const [label, ...rest] = line.split(":")
        rows.push([label.trim(), escapeHtml(rest.join(":").trim())])
      }
      continue
    }
    rows.push(["Note", escapeHtml(lines.join(" "))])
  }
  const message = `${rows.length ? fitTable(rows) : ""}${prizes.length ? prizeFitTable(prizes) : ""}`
  return wrapEmail(subject, `${rsvpShell(greeting, confirmUrl, message)}${mailFooter()}`)
}

function sanitizeMailHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
}

export function composeMessageHtml(subject: string, body: string) {
  const trimmed = body.trim()
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    const inner = `<tr><td class="pad" style="padding:28px 28px 8px;font-family:${FONT};color:#1a1a1a;font-size:16px;line-height:1.55;">${sanitizeMailHtml(trimmed)}</td></tr>`
    return wrapEmail(subject, `${inner}${mailFooter()}`)
  }
  if (/shortlisted for fetch-a-thon|confirm your rsvp|absolutely, i'm in|you are selected/i.test(trimmed)) {
    return rsvpFromCompose(subject, trimmed)
  }
  const rows = body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => composeBlock(part))
    .filter(Boolean)
    .join(sectionGap())
  return wrapEmail(subject, `${brandedRows(rows)}${mailFooter()}`)
}

export function composeMessageText(body: string) {
  return body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim()
}
