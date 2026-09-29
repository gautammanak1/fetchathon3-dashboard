import { cn } from "cn"

export function FetchathonLogo({
  className,
}: {
  className?: string
}) {
  return (
    <span className={cn("flex items-center", className)}>
      {/* Official Fetch.ai wordmark; next/image does not optimize SVG. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fetch-logo-white.svg"
        alt="Fetch.ai"
        width={122}
        height={20}
        className="h-5 w-auto"
      />
    </span>
  )
}
