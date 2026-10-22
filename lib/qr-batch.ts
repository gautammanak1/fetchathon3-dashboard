import { mailVenue } from "@/lib/event-venues"
import { mailMeta, persistMailRecords } from "@/lib/mail-db"
import { findRegistration, loadRosterFast } from "@/lib/roster"
import { resultNote, sendTeamQrEmails } from "@/lib/send-bulk"
import { isSmtpConfigured } from "@/lib/smtp"
import { teamMailGroups } from "@/lib/team-mail"
import { ensureTeamQr, markTeamQrSent, teamKey } from "@/lib/team-qr-store"
import type { RosterPayload } from "@/lib/types"

const SEND_BATCH = 2
const GENERATE_BATCH = 12

export type QrBatchResult = {
  ok: boolean
  error?: string
  status?: number
  count: number
  sent?: number
  teams?: number
  sentIds: string[]
  generatedIds: string[]
  failed: Array<{ id: string; email?: string; error?: string }>
  skipped?: Array<{ id: string; reason: string }>
  batchIds: string[]
  remainingIds: string[]
  done: boolean
  note: string
}

function idsStillWaiting(
  ids: string[],
  roster: RosterPayload,
  waitingKeys: Set<string>,
  doneKeys: Set<string>,
) {
  return ids.filter((id) => {
    const row = findRegistration(roster, id)
    if (!row) return false
    const key = teamKey(row)
    return waitingKeys.has(key) && !doneKeys.has(key)
  })
}

export async function runQrBatch(input: {
  ids: string[]
  mode: "generate" | "send"
  force: boolean
  onlySelected: boolean
  queue: boolean
}): Promise<QrBatchResult> {
  const ids = [...new Set(input.ids.filter(Boolean))]
  const roster = await loadRosterFast()
  const selected = ids
    .map((id) => findRegistration(roster, id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  if (input.mode === "generate") {
    const now = new Date().toISOString()
    const groups = teamMailGroups(selected, roster.registrations)
    const batch = input.queue ? groups.slice(0, GENERATE_BATCH) : groups
    let teams = 0
    const generatedIds: string[] = []
    for (const group of batch) {
      const record = await ensureTeamQr({
        team_key: group.key,
        team_id_display: group.primary.team_id_display || group.key,
        venue: mailVenue(group.primary.city, group.primary.metro).label,
      })
      teams += 1
      const memberIds = group.members.map((member) => member.id)
      generatedIds.push(...memberIds)
      await persistMailRecords(group.members.map(mailMeta), {
        qr_status: "generated",
        qr_token: record.token,
        qr_generated_at: record.generated_at || now,
      })
    }
    const remainingIds = input.queue
      ? idsStillWaiting(
          ids,
          roster,
          new Set(groups.map((group) => group.key)),
          new Set(batch.map((group) => group.key)),
        )
      : []
    return {
      ok: true,
      count: generatedIds.length,
      teams,
      sentIds: [],
      generatedIds,
      failed: [],
      batchIds: generatedIds,
      remainingIds,
      done: remainingIds.length === 0,
      note: `Generated ${teams} team QR ${teams === 1 ? "code" : "codes"} for venue check-in`,
    }
  }

  if (!isSmtpConfigured()) {
    return {
      ok: false,
      error: "Set SMTP_PASSWORD in .env to send QR emails",
      status: 500,
      count: 0,
      sentIds: [],
      generatedIds: [],
      failed: [],
      batchIds: [],
      remainingIds: ids,
      done: false,
      note: "",
    }
  }

  const audience = input.onlySelected
    ? selected.filter((row) => input.force || row.qr_status !== "sent")
    : selected
  const groups = teamMailGroups(
    audience,
    input.onlySelected ? audience : roster.registrations,
  ).filter((group) =>
    input.force ? true : group.members.some((member) => member.qr_status !== "sent"),
  )
  if (groups.length === 0) {
    return {
      ok: true,
      count: 0,
      sent: 0,
      sentIds: [],
      generatedIds: [],
      failed: [],
      skipped: selected.map((row) => ({
        id: row.id,
        reason: "QR mail already sent",
      })),
      batchIds: [],
      remainingIds: [],
      done: true,
      note: "No new QR emails. Selected teams already received the venue pass. Use Send again to resend.",
    }
  }

  const batch = input.queue ? groups.slice(0, SEND_BATCH) : groups
  const batchIds = batch.flatMap((group) => group.members.map((member) => member.id))
  const records = new Map(
    await Promise.all(
      batch.map(async (group) => {
        const record = await ensureTeamQr({
          team_key: group.key,
          team_id_display: group.primary.team_id_display || group.key,
          venue: mailVenue(group.primary.city, group.primary.metro).label,
        })
        await persistMailRecords(group.members.map(mailMeta), {
          qr_status: "generated",
          qr_token: record.token,
          qr_generated_at: record.generated_at,
        })
        return [group.key, record] as const
      }),
    ),
  )

  const result = await sendTeamQrEmails(batch, (group) => records.get(group.key) ?? null)
  const sentGroups = batch.filter((group) =>
    group.members.some((member) => result.sentIds.includes(member.id)),
  )

  if (result.sentIds.length) {
    const sentAt = new Date().toISOString()
    for (const group of sentGroups) {
      const record = records.get(group.key)
      await persistMailRecords(
        group.members
          .filter((member) => result.sentIds.includes(member.id))
          .map(mailMeta),
        {
          qr_status: "sent",
          qr_sent_at: sentAt,
          qr_token: record?.token,
          qr_generated_at: record?.generated_at,
        },
        "qr",
      )
    }
    await markTeamQrSent(sentGroups.map((group) => group.key))
  }

  const remainingIds = input.queue
    ? idsStillWaiting(
        ids,
        roster,
        new Set(groups.map((group) => group.key)),
        new Set(sentGroups.map((group) => group.key)),
      )
    : []
  return {
    ok: result.failed.length === 0,
    count: result.sent,
    sent: result.sent,
    sentIds: result.sentIds,
    generatedIds: [],
    failed: result.failed,
    skipped: result.skipped,
    batchIds,
    remainingIds,
    done: remainingIds.length === 0,
    note: resultNote("QR", result),
  }
}
