export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text.trim()) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new Error("The server timed out. Try that again.")
    }
    throw new Error("The server returned an unexpected response.")
  }
}
