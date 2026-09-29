"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { FetchathonLogo } from "@/components/fetchathon-logo"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error || "Could not sign in")
        return
      }
      await refresh()
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Could not sign in")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-4">
          <FetchathonLogo />
          <div>
            <CardTitle>Admin login</CardTitle>
            <CardDescription>
              Viewers can open the shared dashboard without login. Only admin
              can send seat confirmation and team venue QR emails.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/dashboard">Back to view-only dashboard</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
