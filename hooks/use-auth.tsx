"use client"

import * as React from "react"

type AuthState = {
  isAdmin: boolean
  email: string | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [email, setEmail] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" })
      const payload = (await response.json()) as {
        isAdmin?: boolean
        email?: string | null
      }
      setIsAdmin(Boolean(payload.isAdmin))
      setEmail(payload.email ?? null)
    } catch {
      setIsAdmin(false)
      setEmail(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const logout = React.useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setIsAdmin(false)
    setEmail(null)
  }, [])

  const value = React.useMemo(
    () => ({ isAdmin, email, loading, refresh, logout }),
    [isAdmin, email, loading, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
