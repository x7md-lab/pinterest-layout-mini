import { Link } from "react-router"

export function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <Link to="/" className="text-sm font-semibold underline">
        Back to the feed
      </Link>
    </div>
  )
}
