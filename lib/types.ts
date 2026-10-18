export type DataSource = "notion"
export type RsvpStatus = "none" | "sent" | "confirmed"
export type QrStatus = "none" | "generated" | "sent"

export type Registration = {
  id: string
  name: string
  address: string
  email: string
  phone: string
  role: string
  team_id: string
  team_id_display: string
  participation: string
  are_you: string
  organization: string
  city: string
  metro: string
  skills: string[]
  experience: string
  github: string
  linkedin: string
  team_size: string
  registered_count: string
  seats_remaining: string
  team_status: string
  status: string
  created_at: string
  registration_mail_status: "none" | "sent"
  registration_mail_sent_at: string | null
  registration_mail_count: number
  rsvp_status: RsvpStatus
  rsvp_sent_at: string | null
  rsvp_count: number
  qr_status: QrStatus
  qr_token: string | null
  qr_generated_at: string | null
  qr_sent_at: string | null
  qr_count: number
  reject_status: "none" | "sent"
  reject_sent_at: string | null
  reject_count: number
  property_types: Record<string, string>
}

export type ActionRecord = {
  registration_mail_status: "none" | "sent"
  registration_mail_sent_at: string | null
  registration_mail_count: number
  rsvp_status: RsvpStatus
  rsvp_sent_at: string | null
  rsvp_count: number
  qr_status: QrStatus
  qr_token: string | null
  qr_generated_at: string | null
  qr_sent_at: string | null
  qr_count: number
  reject_status: "none" | "sent"
  reject_sent_at: string | null
  reject_count: number
}

export type Team = {
  team_id: string
  team_id_display: string
  lead_name: string
  lead_email: string
  location: string
  metro: string
  expected_size: number | null
  registered_count: number
  seats_remaining: number | null
  team_status: string
  members: Registration[]
}

export type ChartPoint = {
  name: string
  value: number
}

export type RosterPayload = {
  source: DataSource
  configured: boolean
  schema: Record<string, string>
  registrations: Registration[]
  teams: Team[]
  charts: {
    byLocation: ChartPoint[]
    byCity: ChartPoint[]
    byBuilder: ChartPoint[]
    byCollege: ChartPoint[]
  }
  stats: {
    total: number
    submitted: number
    drafts: number
    teams: number
    completeTeams: number
    registrationMailSent: number
    rsvpSent: number
    qrGenerated: number
    qrSent: number
  }
}

export type Filters = {
  q: string
  metro: string[]
  location: string[]
  builder: string[]
  college: string[]
  role: string[]
  status: string[]
  registrationMail: string[]
  rsvp: string[]
  qr: string[]
}
