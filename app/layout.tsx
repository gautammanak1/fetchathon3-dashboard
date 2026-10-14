import type { Metadata } from "next"
import { Lexend } from "next/font/google"

import { Providers } from "@/components/providers"

import "./globals.css"

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
})

export const metadata: Metadata = {
  title: "fetchathon3",
  description: "Fetchathon 3 registration operations dashboard",
  icons: {
    icon: "/fetchathon3-logo.png",
  },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${lexend.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
