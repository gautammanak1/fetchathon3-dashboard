import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

function dataDir() {
  if (process.env.VERCEL) return path.join("/tmp", "fetchathon3-data")
  return path.join(process.cwd(), ".data")
}

export async function readJsonFile<T extends object>(
  name: string,
  fallback: T,
): Promise<T> {
  try {
    const raw = await readFile(path.join(dataDir(), name), "utf8")
    const parsed = JSON.parse(raw) as T
    return parsed && typeof parsed === "object" ? parsed : fallback
  } catch {
    return fallback
  }
}

export async function writeJsonFile(name: string, data: unknown) {
  try {
    const dir = dataDir()
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, name), JSON.stringify(data, null, 2))
  } catch (error) {
    console.error(`Failed to write ${name}`, error)
  }
}
