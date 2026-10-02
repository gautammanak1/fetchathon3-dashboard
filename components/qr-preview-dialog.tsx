"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function QrPreviewDialog({
  open,
  onOpenChange,
  name,
  dataUrl,
  token,
  passUrl,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  dataUrl: string | null
  token: string | null
  passUrl: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Team venue QR</DialogTitle>
          <DialogDescription>
            One code for the whole team. Show this at venue check-in. {name}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {dataUrl ? (
            // Data URLs are generated locally for check-in codes.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt={`QR for ${name}`}
              width={240}
              height={240}
              className="rounded-md border bg-white p-2"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Generating...</p>
          )}
          {token ? (
            <p className="font-mono text-xs text-muted-foreground">{token}</p>
          ) : null}
          {passUrl ? (
            <Button variant="outline" asChild>
              <a href={passUrl} target="_blank" rel="noreferrer">
                Open venue pass
              </a>
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
