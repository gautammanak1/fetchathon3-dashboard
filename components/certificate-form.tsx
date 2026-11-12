"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CERTIFICATE_SHARE_TEXT, certificateImagePath, certificatePagePath } from "@/lib/certificate-share"

const REPO_URL = "https://github.com/fetchai/innovation-lab-examples"

function shareTarget(site: "x" | "linkedin", pageUrl: string) {
  const text = `${CERTIFICATE_SHARE_TEXT}\n\n${pageUrl}`
  if (site === "x") {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(CERTIFICATE_SHARE_TEXT)}&url=${encodeURIComponent(pageUrl)}`
  }
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`
}

export function CertificateForm() {
  const [github, setGithub] = React.useState("")
  const [name, setName] = React.useState("")
  const [checked, setChecked] = React.useState(false)
  const [starred, setStarred] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<"check" | "download" | "share" | null>(null)

  const checkStar = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy("check")
    setError(null)
    setStarred(false)
    setChecked(false)
    setName("")
    try {
      const response = await fetch("/api/certificate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github }),
      })
      const payload = (await response.json()) as { error?: string; starred?: boolean; name?: string }
      if (!response.ok) throw new Error(payload.error || "Could not check the star")
      setName(payload.name || "")
      setStarred(Boolean(payload.starred))
      setChecked(true)
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Could not check the star")
    } finally {
      setBusy(null)
    }
  }

  const download = async () => {
    setBusy("download")
    setError(null)
    try {
      const response = await fetch("/api/certificate/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || "Could not download the certificate")
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "Fetch-A-Thon-3.0-certificate.pdf"
      link.click()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download the certificate")
    } finally {
      setBusy(null)
    }
  }

  const share = async (site: "x" | "linkedin") => {
    setBusy("share")
    setError(null)
    const pageUrl = `${window.location.origin}${certificatePagePath(github)}`
    const text = `${CERTIFICATE_SHARE_TEXT}\n\n${pageUrl}`
    try {
      const response = await fetch(certificateImagePath(github))
      if (!response.ok) throw new Error("Could not prepare the certificate photo")
      const file = new File([await response.blob()], "Fetch-A-Thon-3.0-certificate.png", { type: "image/png" })
      const payload = { text, files: [file] }
      if (navigator.canShare?.(payload)) {
        await navigator.share(payload)
        return
      }
      window.open(shareTarget(site, pageUrl), "_blank", "noopener,noreferrer")
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === "AbortError") return
      window.open(shareTarget(site, pageUrl), "_blank", "noopener,noreferrer")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 rounded-lg border p-4 text-sm leading-6">
        <p>Please star this repo to support the community.</p>
        <Button variant="outline" asChild>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {REPO_URL}
          </a>
        </Button>
      </div>
      <form className="grid gap-5" onSubmit={checkStar}>
        <div className="grid gap-2">
          <Label htmlFor="certificate-github">If you have starred it, add your GitHub username and verify</Label>
          <Input
            id="certificate-github"
            value={github}
            onChange={(event) => {
              setGithub(event.target.value)
              setStarred(false)
              setChecked(false)
            }}
            placeholder="your-github-username"
            required
          />
        </div>
        <Button type="submit" disabled={busy !== null}>
          {busy === "check" ? "Verifying…" : "Verify"}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {checked && !starred ? (
          <p className="text-sm leading-6">
            This GitHub account has not starred the repository yet. Star it, then verify again.
          </p>
        ) : null}
        {starred ? (
          <div className="grid gap-3 rounded-lg border p-4 text-sm leading-6">
            <p>Star verified. Your certificate is ready for {name}.</p>
            <img
              src={certificateImagePath(github)}
              alt={`Fetch-A-Thon 3.0 certificate for ${name}`}
              className="w-full rounded-lg border"
            />
            <p className="whitespace-pre-wrap">{CERTIFICATE_SHARE_TEXT}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={download} disabled={busy !== null}>
                {busy === "download" ? "Preparing PDF…" : "Download certificate"}
              </Button>
              <Button type="button" variant="outline" onClick={() => share("linkedin")} disabled={busy !== null}>
                Share on LinkedIn
              </Button>
              <Button type="button" variant="outline" onClick={() => share("x")} disabled={busy !== null}>
                Share on X
              </Button>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  )
}
