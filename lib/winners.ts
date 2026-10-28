import { normalizeTeamId } from "@/lib/fields"

export const PROJECT_WINNERS = [
  { id: "1899", place: "National Winner" },
  { id: "3201", place: "1st Runner-Up" },
  { id: "4064", place: "2nd Runner-Up" },
  { id: "3334", place: "Best Multi-Agent Workflow" },
  { id: "2715", place: "Best Multi-Agent Workflow" },
  { id: "1450", place: "Best Agentverse Deployment" },
  { id: "1118", place: "Best Agentverse Deployment" },
  { id: "1556", place: "Best Personal AI" },
] as const

export function projectPlace(teamId: string, display = "") {
  const key = normalizeTeamId(teamId || display)
  return PROJECT_WINNERS.find((row) => row.id === key)?.place || ""
}

export function projectWinnerRank(teamId: string, display = "") {
  const key = normalizeTeamId(teamId || display)
  const index = PROJECT_WINNERS.findIndex((row) => row.id === key)
  return index === -1 ? PROJECT_WINNERS.length : index
}
