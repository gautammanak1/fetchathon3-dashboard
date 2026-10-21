export const HACKPACK_URL =
  "https://innovationlab.fetch.ai/events/hackathons/fetch-a-thon-3/hackpack"
export const DOCS_URL = "https://innovationlab.fetch.ai/resources/docs/intro"
export const EXAMPLES_URL = "https://github.com/fetchai/innovation-lab-examples"
export const OFFER_CODE = "FETCHATHONIND"
export const DISCORD_NOTE =
  "Please join Discord and ask if you have any query in the Fetch-A-Thon 3.0 channel."
export const EVENT_DATE = "24 October 2026"

const MAPS = {
  roorkee: "https://maps.app.goo.gl/3ynpRgj136u87WBv6",
  gurugram: "https://maps.app.goo.gl/jp5cWD2jbc7hb4Yx7",
  jaipur: "https://maps.app.goo.gl/KzG4VgurLzQthoSD9",
  mandi: "https://maps.app.goo.gl/wA3ae8j95hAynnb76",
  bengaluru:
    "https://www.google.com/maps/search/?api=1&query=Presidency+University+Itgalpur+Rajanakunte+Yelahanka+Bengaluru",
} as const

export type MailVenue = {
  key: string
  label: string
  mapUrl: string | null
  note: string
}

export const PRIZES: Array<[string, string, string]> = [
  ["National Winners", "₹35,000", "Cash Prize + Internship Interview Opportunity"],
  ["First Runner-up", "₹25,000", "Cash Prize + Internship Interview Opportunity"],
  ["2nd Runner-up", "₹15,000", "Cash Prize + Internship Interview Opportunity"],
  ["Best Multi-Agent Workflow X2", "₹5,000", "Cash Prize"],
  ["Best Agentverse Deployment X2", "₹5,000", "Cash Prize"],
  ["Best Personal AI", "₹5,000", "Cash Prize"],
]

export function mailVenue(city: string, metro = ""): MailVenue {
  const text = `${city} ${metro}`.toLowerCase()
  if (text.includes("online")) {
    return {
      key: "online",
      label: "Online",
      mapUrl: null,
      note: "This is the online edition. There is no venue to visit.",
    }
  }
  if (text.includes("jaipur")) {
    return { key: "jaipur", label: "Jaipur", mapUrl: MAPS.jaipur, note: "This is your location." }
  }
  if (text.includes("mandi")) {
    return { key: "mandi", label: "IIT Mandi", mapUrl: MAPS.mandi, note: "This is your location." }
  }
  if (text.includes("roorkee") || text.includes("rit")) {
    return { key: "roorkee", label: "RIT Roorkee", mapUrl: MAPS.roorkee, note: "This is your location." }
  }
  if (
    text.includes("noida") ||
    text.includes("amity") ||
    text.includes("gurugram") ||
    text.includes("gurgaon") ||
    text.includes("masters")
  ) {
    return {
      key: "gurugram",
      label: "Masters' Union Gurugram",
      mapUrl: MAPS.gurugram,
      note: "This is your location.",
    }
  }
  if (text.includes("bengaluru") || text.includes("bangalore")) {
    return {
      key: "bengaluru",
      label: "Presidency University, Bengaluru",
      mapUrl: MAPS.bengaluru,
      note: "Itgalpur Rajanakunte, Yelahanka, Bengaluru",
    }
  }
  const label = city.trim() || metro.trim() || "your venue"
  return { key: "other", label, mapUrl: null, note: "" }
}
