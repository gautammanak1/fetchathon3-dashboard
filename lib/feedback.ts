import { db } from "@/lib/db"
import { FEEDBACK_AGAIN, FEEDBACK_AREAS, FEEDBACK_CITIES, FEEDBACK_ROLES } from "@/lib/feedback-options"

export type FeedbackInput = {
  name: string
  email: string
  teamId: string
  city: string
  role: string
  rating: number | null
  wentWell: string
  problems: string
  problemAreas: string[]
  useAgain: string
  fixNext: string
  techFeedback: string
  asi1Feedback: string
  anythingElse: string
}

function clip(value: unknown, max: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max)
}

function clipBlock(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max)
}

export function parseFeedback(body: unknown): FeedbackInput {
  const item = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const ratingRaw = Number(item.rating)
  const rating = Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null
  const city = clip(item.city, 80)
  const role = clip(item.role, 80)
  const useAgain = clip(item.useAgain, 20).toLowerCase()
  const areas = Array.isArray(item.problemAreas) ? item.problemAreas : []
  const problemAreas = [...new Set(areas.map((area) => clip(area, 80)).filter((area) => FEEDBACK_AREAS.includes(area as (typeof FEEDBACK_AREAS)[number])))]
  const problems = clipBlock(item.problems, 4000)
  if (!problems) throw new Error("Tell us the problem you ran into")
  if (city && !FEEDBACK_CITIES.includes(city as (typeof FEEDBACK_CITIES)[number])) {
    throw new Error("Choose a city from the list")
  }
  if (role && !FEEDBACK_ROLES.includes(role as (typeof FEEDBACK_ROLES)[number])) {
    throw new Error("Choose a role from the list")
  }
  if (useAgain && !FEEDBACK_AGAIN.includes(useAgain as (typeof FEEDBACK_AGAIN)[number])) {
    throw new Error("Choose whether you would use it again")
  }
  return {
    name: clip(item.name, 120),
    email: clip(item.email, 200).toLowerCase(),
    teamId: clip(item.teamId, 80),
    city,
    role,
    rating,
    wentWell: clipBlock(item.wentWell, 4000),
    problems,
    problemAreas,
    useAgain,
    fixNext: clipBlock(item.fixNext, 4000),
    techFeedback: clipBlock(item.techFeedback, 4000),
    asi1Feedback: clipBlock(item.asi1Feedback, 4000),
    anythingElse: clipBlock(item.anythingElse, 4000),
  }
}

export async function saveFeedback(input: FeedbackInput) {
  const sql = db()
  if (!sql) throw new Error("Database is not configured")
  const rows = await sql<{ id: string }[]>`
    insert into feedback (
      name, email, team_id, city, role, rating, went_well, problems,
      problem_areas, use_again, fix_next, tech_feedback, asi1_feedback, anything_else, payload
    ) values (
      ${input.name},
      ${input.email},
      ${input.teamId},
      ${input.city},
      ${input.role},
      ${input.rating},
      ${input.wentWell},
      ${input.problems},
      ${sql.array(input.problemAreas, 1009)},
      ${input.useAgain},
      ${input.fixNext},
      ${input.techFeedback},
      ${input.asi1Feedback},
      ${input.anythingElse},
      ${sql.json(JSON.parse(JSON.stringify(input)))}
    )
    returning id
  `
  return rows[0]?.id || ""
}
