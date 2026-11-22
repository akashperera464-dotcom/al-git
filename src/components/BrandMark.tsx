/**
 * Shared brand-logo renderer for every chrome surface (login hero, shell
 * drawer, sidebar, mobile app bar).
 *
 * WHY NOT ALWAYS A WHITE CHIP: the bundled default mark
 * (/branding/dalu-plus-mark.png) is pre-trimmed to a square WITH its own
 * rounded corners and a transparent background. On a white plate the mark's
 * transparent corners/edges let the plate show through as an uneven white
 * rim — the "sticker" look on the dark login hero the user rejected. Bundled
 * art therefore floats free with an alpha-silhouette drop shadow (the same
 * look as the official artwork on the dark background).
 *
 * Custom Brandings URLs keep the white chip: a dark custom logo must stay
 * legible on the dark chrome, and opaque uploads (JPEG/flat PNG) cover the
 * chip completely, so nothing changes for them.
 */
export const BUNDLED_MARK_URL = "/branding/dalu-plus-mark.png";

interface BrandMarkProps {
  url: string;
  /** Square badge size in px. */
  size: number;
  alt?: string;
}

export function BrandMark({ url, size, alt = "logo" }: BrandMarkProps) {
  if (url === BUNDLED_MARK_URL) {
    return (
      <img
        src={url}
        alt={alt}
        width={size}
        height={size}
        className="shrink-0 object-cover"
        style={{ width: size, height: size, filter: "drop-shadow(0 3px 8px rgba(0, 0, 0, 0.45))" }}
        onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/5"
      style={{ width: size, height: size }}
    >
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    </span>
  );
}
