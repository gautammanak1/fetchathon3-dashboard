import { EMAIL_RE } from "@/lib/smtp"
import { teamKey } from "@/lib/team-qr-store"
import type { Registration } from "@/lib/types"

export type TeamMailGroup = {
  key: string
  primary: Registration
  members: Registration[]
  to: { name: string; email: string }
  cc: Array<{ name: string; email: string }>
}

function pickPrimary(members: Registration[]) {
  return (
    members.find((member) => member.role.toLowerCase() === "lead") || members[0]
  )
}

function uniqueRecipients(members: Registration[]) {
  const seen = new Set<string>()
  const recipients: Array<{ member: Registration; email: string }> = []
  for (const member of members) {
    const email = member.email.trim().toLowerCase()
    if (!EMAIL_RE.test(email) || seen.has(email)) continue
    seen.add(email)
    recipients.push({ member, email })
  }
  return recipients
}

export function hasRsvpMail(row: Pick<Registration, "rsvp_status">) {
  return row.rsvp_status !== "none"
}

export function groupWithoutPriorRsvp(group: TeamMailGroup): TeamMailGroup | null {
  const pending = group.members.filter((member) => !hasRsvpMail(member))
  if (pending.length === 0) return null
  if (pending.length === group.members.length) return group
  return teamMailGroups(pending, pending)[0] || null
}

export function teamMailGroups(
  selected: Registration[],
  roster: Registration[],
): TeamMailGroup[] {
  const byKey = new Map<string, Registration[]>()
  for (const row of roster) {
    const key = teamKey(row)
    const list = byKey.get(key) || []
    list.push(row)
    byKey.set(key, list)
  }

  const seen = new Set<string>()
  const groups: TeamMailGroup[] = []
  for (const row of selected) {
    const key = teamKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    const members = byKey.get(key) || [row]
    const primary = pickPrimary(members)
    const recipients = uniqueRecipients(members)
    const toRow =
      recipients.find((item) => item.member.id === primary.id) || recipients[0]
    groups.push({
      key,
      primary,
      members,
      to: toRow
        ? { name: toRow.member.name, email: toRow.email }
        : { name: primary.name, email: "" },
      cc: toRow
        ? recipients
            .filter((item) => item.email !== toRow.email)
            .map((item) => ({ name: item.member.name, email: item.email }))
        : [],
    })
  }
  return groups
}
