import {
  DOCS_URL,
  EVENT_DATE,
  EXAMPLES_URL,
  HACKPACK_URL,
  OFFER_CODE,
  PRIZES,
  mailVenue,
  type MailVenue,
} from "@/lib/event-venues"

export function rsvpPlainMessage(input: {
  greeting: string
  venue: MailVenue
  confirmUrl: string
  discordUrl: string
  teamLines?: string[]
}) {
  const place = input.venue.mapUrl
    ? `This is your location: ${input.venue.label}\n${input.venue.mapUrl}`
    : `This is your location: ${input.venue.label}`
  const lines = [
    input.greeting,
    "",
    "You are selected for Fetch-A-Thon 3.0. Please start building your project.",
    `The hackathon is on ${EVENT_DATE}.`,
    "",
    input.confirmUrl
      ? `Confirm your seat: ${input.confirmUrl}`
      : "Confirm your seat: {{confirm_url}}",
    "",
    place,
    input.venue.note === "This is your location." ? "" : input.venue.note,
    "",
    `Join Discord and stay with your team there: ${input.discordUrl}`,
    "",
    "Exclusive offer",
    "Unlock one month free access to ASI:One Pro and Agentverse Premium.",
    `Use code: ${OFFER_CODE}`,
    "",
    `Hackpack: ${HACKPACK_URL}`,
    "",
    "Prizes",
    ...PRIZES.map(([name, amount, detail]) => `${name}: ${amount} — ${detail}`),
    "",
    "Start here",
    `Example agents: ${EXAMPLES_URL}`,
    `Docs: ${DOCS_URL}`,
    "",
    ...(input.teamLines || []),
    "",
    "For any queries, email innovationlab@fetch.ai.",
    "",
    "Fetch-A-Thon / Fetch.ai Innovation Lab",
  ]
  return lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n")
}

const TEMPLATE_VENUES: Array<{ name: string; city: string; metro?: string }> = [
  { name: "RSVP · RIT Roorkee", city: "RIT Roorkee", metro: "Roorkee" },
  { name: "RSVP · Gurugram", city: "Gurugram", metro: "Gurugram" },
  { name: "RSVP · Noida", city: "Noida", metro: "Noida" },
  { name: "RSVP · Jaipur", city: "Jaipur", metro: "Jaipur" },
  { name: "RSVP · IIT Mandi", city: "IIT Mandi", metro: "Mandi" },
  { name: "RSVP · Online", city: "Online", metro: "Online" },
]

export function defaultRsvpTemplates() {
  return TEMPLATE_VENUES.map((item) => {
    const venue = mailVenue(item.city, item.metro || "")
    return {
      name: item.name,
      subject: `You're selected for Fetch-A-Thon 3.0 — ${venue.label}`,
      body: rsvpPlainMessage({
        greeting: "Hi {{name}}!",
        venue,
        confirmUrl: "",
        discordUrl:
          (process.env.FETCHATHON_DISCORD_URL || "https://discord.gg/fetchai").trim() ||
          "https://discord.gg/fetchai",
        teamLines: ["Team: {{team}}", "Venue: {{venue}}"],
      }),
    }
  })
}
