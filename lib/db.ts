import postgres from "postgres"

type Sql = ReturnType<typeof postgres>

const globalForDb = globalThis as unknown as { fetchathonSql?: Sql }

export function db() {
  const url = process.env.SUPABASE_DB_URL
  if (!url) return null
  if (!globalForDb.fetchathonSql) {
    globalForDb.fetchathonSql = postgres(url, {
      prepare: false,
      ssl: "require",
      max: 4,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  }
  return globalForDb.fetchathonSql
}

export function isoTime(value: unknown) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const text = String(value).trim()
  return text || null
}
