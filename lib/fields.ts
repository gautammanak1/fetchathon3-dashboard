export const DEFAULT_FIELDS = {
  name: "Name",
  address: "Address",
  email: "Email",
  phone: "Phone",
  role: "Role",
  team_id: "Team ID",
  participation: "Participation",
  are_you: "Are you",
  organization: "Organization",
  city: "City",
  skills: "Skills",
  experience: "Experience",
  github: "GitHub",
  linkedin: "LinkedIn",
  team_size: "Team size",
  registered_count: "Registered count",
  seats_remaining: "Seats remaining",
  team_status: "Team status",
  status: "Status",
} as const

export const ACTION_FIELDS = {
  rsvp_status: "RSVP Status",
  qr_status: "QR Status",
} as const

export type FieldKey = keyof typeof DEFAULT_FIELDS

export const FIELD_COLUMNS = Object.entries(DEFAULT_FIELDS) as [
  FieldKey,
  string,
][]

export const TEAM_CODE_PREFIX = "fetchathon3.0-"

export const VENUE_OPTIONS = [
  { value: "paytm_office_noida", label: "Paytm Office Noida", metro: "Noida" },
  {
    value: "amity_university_noida",
    label: "Amity University Noida",
    metro: "Noida",
  },
  { value: "jaipur", label: "Jaipur", metro: "Jaipur" },
  { value: "bengaluru", label: "Bengaluru", metro: "Bengaluru" },
  { value: "iit_mandi", label: "IIT Mandi", metro: "Mandi" },
  { value: "online", label: "Online", metro: "Online" },
] as const

export const BUILDER_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "working_professional", label: "Working Professional" },
  { value: "founder", label: "Founder" },
  { value: "other", label: "Other" },
] as const

export function parseFieldMap(raw?: string | null) {
  if (!raw?.trim()) return { ...DEFAULT_FIELDS }
  try {
    const data = JSON.parse(raw) as Record<string, string>
    if (!data || typeof data !== "object") return { ...DEFAULT_FIELDS }
    return {
      ...DEFAULT_FIELDS,
      ...Object.fromEntries(
        Object.entries(data).filter(([, value]) => String(value).trim()),
      ),
    }
  } catch {
    return { ...DEFAULT_FIELDS }
  }
}

export function extractDatabaseId(urlOrId: string) {
  const match = urlOrId.match(
    /([0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12})/,
  )
  return match?.[1] ?? urlOrId.trim()
}

export function normalizeTeamId(raw: string) {
  const text = String(raw || "")
    .trim()
    .replace(/^fetchathon3\.[0o]-/i, "")
    .replace(/\.0$/, "")
  return text.replace(/\D/g, "")
}

export function formatTeamId(raw: string) {
  const tid = normalizeTeamId(raw)
  return tid ? `${TEAM_CODE_PREFIX}${tid}` : ""
}

export function deriveMetro(location: string) {
  const text = location.trim().toLowerCase()
  if (!text) return "Unknown"
  const hit = VENUE_OPTIONS.find(
    (option) =>
      option.label.toLowerCase() === text ||
      option.value === text ||
      option.metro.toLowerCase() === text,
  )
  if (hit) return hit.metro
  if (text.includes("noida")) return "Noida"
  if (text.includes("jaipur")) return "Jaipur"
  if (text.includes("bengaluru") || text.includes("bangalore")) return "Bengaluru"
  if (text.includes("mandi")) return "Mandi"
  if (text.includes("online")) return "Online"
  return location
}

export function isHiddenVenue(location: string, metro = "") {
  const text = `${location} ${metro}`.toLowerCase()
  return (
    text.includes("mumbai") ||
    text.includes("bhopal") ||
    text.includes("pune")
  )
}
