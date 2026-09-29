"use client"

import Link from "next/link"

import { useAuth } from "@/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function AuthControls() {
  const { isAdmin, email, loading, logout } = useAuth()

  if (loading) return null

  if (isAdmin) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline">Admin</Badge>
        <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:inline">
          {email}
        </span>
        <Button variant="outline" size="sm" onClick={() => void logout()}>
          Log out
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline">View only</Badge>
      <Button variant="outline" size="sm" asChild>
        <Link href="/login">Admin login</Link>
      </Button>
    </div>
  )
}
