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

function participationBlurb(row: Registration) {
  const mode = participationMode(row)
  const role = clean(row.role).toLowerCase()
  const teamId = row.team_id_display
  const size = Number(row.team_size)
  if (mode === "solo") {
    return {
      label: "Solo",
      blurb: "You are confirmed as a solo participant.",
    }
  }
  if (role === "lead") {
    const sizeBit = Number.isFinite(size) && size > 0
      ? ` Your team size is ${size}, including you.`
      : ""
    const share = teamId
      ? ` Your teammates will use Team ID ${teamId} at the venue.`
      : ""
    return {
      label: "Team",
      blurb: `You are confirmed as the team lead.${sizeBit}${share}`,
    }
  }
  const joined = teamId ? ` You are confirmed on Team ID ${teamId}.` : ""
  return {
    label: "Team",
    blurb: `You are confirmed as a team member.${joined}`,
  }
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
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f8;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;">
          ${bannerHtml()}
          ${inner}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function membersTableHtml(members: Registration[], row: Registration) {
  const rows: Array<[string, string]> = [
    ["Team ID", clean(row.team_id_display)],
    ["Venue", clean(row.city)],
    ...members.map((member) => {
      const label = clean(member.role) || "Member"
      const value = [clean(member.name), clean(member.email)].filter(Boolean).join(" · ")
      return [label, value] as [string, string]
    }),
  ]
  const visible = rows.filter(([, value]) => value)
  return visible
    .map(([label, value], index) => {
      const border = index < visible.length - 1 ? "border-bottom:1px solid #eeeaf6;" : ""
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
    .join("")
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

export function rsvpSubject() {
  return "Your Fetch-A-Thon 3.0 seat is confirmed"
}

function teamGreeting(row: Registration, members: Registration[]) {
  if (members.length > 1) {
    const names = members.map((member) => clean(member.name)).filter(Boolean)
    return names.length ? `Hi ${names.join(", ")}!` : "Hi team!"
  }
  return `Hi ${clean(row.name) || "there"}!`
}

function membersListText(members: Registration[]) {
  return members.map((member) => {
    const bits = [clean(member.name) || "Untitled", clean(member.role), clean(member.email)]
      .filter(Boolean)
    return `- ${bits.join(" · ")}`
  })
}

export function rsvpText(row: Registration, members: Registration[] = [row]) {
  const team = members.length > 1
  const { label, blurb } = participationBlurb(row)
  const lines = [
    teamGreeting(row, members),
    "",
    team
      ? "Your team seats for Fetch-A-Thon 3.0 are confirmed."
      : "Your seat for Fetch-A-Thon 3.0 is confirmed.",
    "Please keep this email. We will send your team venue QR later so you can check in at the venue.",
    team
      ? "This was sent once to the whole team. Teammates are on CC, so nobody gets a second copy."
      : "",
    "",
    `Participation: ${label}`,
    blurb,
    "",
    team ? "Team" : "Your registration details",
  ]
  if (team) {
    lines.push(...membersListText(members))
    lines.push("", `Team ID: ${clean(row.team_id_display)}`, `Venue: ${clean(row.city)}`)
  } else {
    for (const [field, value] of detailRows(row)) {
      lines.push(`- ${field}: ${value}`)
    }
  }
  lines.push(
    "",
    `Event page: ${eventPageUrl()}`,
    `Join Discord: ${discordInviteUrl()}`,
    "",
    "For any queries, email innovationlab@fetch.ai and the Innovation Lab team will get back to you.",
    "",
    "Fetch-A-Thon / Fetch.ai Innovation Lab",
  )
  return lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n")
}

export function rsvpHtml(row: Registration, members: Registration[] = [row]) {
  const team = members.length > 1
  const name = escapeHtml(teamGreeting(row, members).replace(/^Hi |!$/g, "") || "there")
  const { label, blurb } = participationBlurb(row)
  const inner = `
          <tr>
            <td style="padding:32px 36px 0;font-family:${FONT};color:#1a1740;">
              <p style="margin:0;font-size:26px;line-height:1.25;font-weight:700;">Hi ${name}!</p>
              <p style="margin:14px 0 0;font-size:16px;line-height:1.65;color:#3d3958;">
                ${team
                  ? "Your team seats for Fetch-A-Thon 3.0 are confirmed."
                  : "Your seat for Fetch-A-Thon 3.0 is confirmed."}
              </p>
              <p style="margin:8px 0 0;font-size:16px;line-height:1.65;color:#3d3958;">
                Please keep this email. We will send your team venue QR later so you can check in at the venue.
                ${team
                  ? " This was sent once to the whole team. Teammates are on CC."
                  : ""}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="4" style="width:4px;background:#5b45f5;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:2px 0 2px 16px;font-family:${FONT};">
                    <p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.14em;text-transform:uppercase;color:#8a849e;">Confirmed as</p>
                    <p style="margin:6px 0 0;font-size:22px;line-height:1.2;font-weight:700;color:#2a1f8f;">${escapeHtml(label)}</p>
                    <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#4a4663;">${escapeHtml(blurb)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 0;font-family:${FONT};">
              <p style="margin:0 0 4px;padding-bottom:8px;border-bottom:1px solid #ece8f5;font-size:12px;line-height:1.4;letter-spacing:0.14em;text-transform:uppercase;color:#8a849e;">${team ? "Team" : "Your details"}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${team ? membersTableHtml(members, row) : detailsTableHtml(row)}
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
                This email confirms your seat. Bring your team venue QR when you arrive.
              </p>
              <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#8a849e;">Fetch-A-Thon / Fetch.ai Innovation Lab</p>
            </td>
          </tr>`
  return wrapEmail(rsvpSubject(), inner)
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
  const name = clean(input.row.name) || "there"
  return [
    `Hi ${name}!`,
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
    `Join Discord: ${discordInviteUrl()}`,
    "",
    "For any queries, email innovationlab@fetch.ai.",
    "",
    "Fetch-A-Thon / Fetch.ai Innovation Lab",
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
  const name = escapeHtml(clean(input.row.name) || "there")
  const teamId = escapeHtml(input.teamIdDisplay || "Solo")
  const venue = escapeHtml(input.venue || "See event page")
  const members = escapeHtml(input.memberNames.join(", ") || clean(input.row.name))
  const inner = `
          <tr>
            <td style="padding:32px 36px 0;font-family:${FONT};color:#1a1740;">
              <p style="margin:0;font-size:26px;line-height:1.25;font-weight:700;">Hi ${name}!</p>
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
              <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#8a849e;">Fetch-A-Thon / Fetch.ai Innovation Lab</p>
            </td>
          </tr>`
  return wrapEmail(qrSubject(input.teamIdDisplay), inner)
}
