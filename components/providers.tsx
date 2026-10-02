"use client"

import { ThemeProvider } from "next-themes"

import { AuthProvider } from "@/hooks/use-auth"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  )
}
