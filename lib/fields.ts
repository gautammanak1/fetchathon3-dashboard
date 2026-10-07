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
  registration_mail_status: "Registration Mail",
  rsvp_status: "RSVP Status",
  qr_status: "QR Status",
} as const

export const REGISTRATION_MAIL_FIELD_ALIASES = [
  "Registration Mail",
  "Reg Mail",
  "Registration Mail Status",
]

export const RSVP_FIELD_ALIASES = ["RSVP Status", "RSVP", "Rsvp Status"]
export const QR_FIELD_ALIASES = ["QR Status", "QR", "Qr Status"]
export const CHECKIN_FIELD_ALIASES = [
  "Check-in",
  "Check In",
  "Checked In",
  "Checkin",
  "Joined",
  "Attendance",
]

export type FieldKey = keyof typeof DEFAULT_FIELDS

export const FIELD_COLUMNS = Object.entries(DEFAULT_FIELDS) as [
  FieldKey,
  string,
][]

export const TEAM_CODE_PREFIX = "fetchathon3.0-"

export const VENUE_OPTIONS = [
  {
    value: "amity_university_noida",
    label: "Amity University Noida",
    metro: "Noida",
  },
  { value: "jaipur", label: "Jaipur", metro: "Jaipur" },
  { value: "bengaluru", label: "Bengaluru", metro: "Bengaluru" },
  { value: "iit_mandi", label: "IIT Mandi", metro: "Mandi" },
  { value: "rit_roorkee", label: "RIT Roorkee", metro: "Roorkee" },
  {
    value: "masters_union_gurugram",
    label: "Masters' Union Gurugram",
    metro: "Gurugram",
  },
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

export function formatVenue(location: string) {
  const text = location.trim()
  if (!text) return ""
  const lower = text.toLowerCase()
  const hit = VENUE_OPTIONS.find(
    (option) =>
      option.label.toLowerCase() === lower ||
      option.value === lower ||
      option.metro.toLowerCase() === lower,
  )
  if (hit) return hit.label
  if (lower.includes("amity")) return "Amity University Noida"
  if (lower.includes("jaipur")) return "Jaipur"
  if (lower.includes("bengaluru") || lower.includes("bangalore")) return "Bengaluru"
  if (lower.includes("mandi")) return "IIT Mandi"
  if (lower.includes("roorkee") || lower.includes("rit")) return "RIT Roorkee"
  if (
    lower.includes("masters") ||
    lower.includes("gurugram") ||
    lower.includes("gurgaon")
  ) {
    return "Masters' Union Gurugram"
  }
  if (lower.includes("online")) return "Online"
  return text
}

export function deriveMetro(location: string) {
  const text = location.trim().toLowerCase()
  if (!text) return "Unknown"
  const label = formatVenue(location)
  const hit = VENUE_OPTIONS.find((option) => option.label === label)
  if (hit) return hit.metro
  if (text.includes("noida")) return "Noida"
  if (text.includes("jaipur")) return "Jaipur"
  if (text.includes("bengaluru") || text.includes("bangalore")) return "Bengaluru"
  if (text.includes("mandi")) return "Mandi"
  if (text.includes("roorkee") || text.includes("rit")) return "Roorkee"
  if (text.includes("gurugram") || text.includes("gurgaon") || text.includes("masters")) {
    return "Gurugram"
  }
  if (text.includes("online")) return "Online"
  return location
}

export function normalizeOrganization(raw: string) {
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text) return "Unknown"
  const key = text.toLowerCase().replace(/[^a-z0-9]+/g, "")
  if (
    key === "rit" ||
    key.includes("ritroorkee") ||
    key.includes("roorkeeinstituteoftechnology") ||
    (key.includes("roorkee") && key.includes("institute"))
  ) {
    return "RIT Roorkee"
  }
  if (key.includes("galgotia")) return "Galgotias College"
  if (key.includes("amity")) return "Amity University"
  if (key.includes("bmlmunjal")) return "BML Munjal University"
  if (key.includes("mastersunion") || key.includes("mastersuniongurugram")) {
    return "Masters' Union"
  }
  if (key.includes("iitmandi") || (key.includes("iit") && key.includes("mandi"))) {
    return "IIT Mandi"
  }
  return text
}

export function isHiddenVenue(location: string, metro = "") {
  const text = `${location} ${metro}`.toLowerCase()
  return (
    text.includes("mumbai") ||
    text.includes("bhopal") ||
    text.includes("pune")
  )
}
