export type FeedbackEntry = {
  id: string
  createdAt: string
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
