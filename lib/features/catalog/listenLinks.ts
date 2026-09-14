import type { AlbumMetadata } from "@/lib/features/metadata/types";

/**
 * One "Listen" chip. An absent `href` renders as a non-anchor label — the
 * definitive-links contract makes no scheme promise, so a value that will not
 * parse as http(s) is shown rather than dropped, just not linked.
 */
export type ListenLink = {
  /** Stable React key. */
  key: string;
  label: string;
  href?: string;
};

type ServiceKey =
  | "spotify"
  | "appleMusic"
  | "youtube"
  | "bandcamp"
  | "soundcloud"
  | "discogs";

type ServiceDef = {
  key: ServiceKey;
  label: string;
  metadataKey: keyof AlbumMetadata;
  /** Registrable domains whose host — exactly, or as a subdomain — is this service. */
  hosts: string[];
};

// Order here is the Listen chip order for LML and overridden services. A
// definitive link joins its service in place; only unrecognised-host links are
// appended after, in paste order.
const SERVICES: ServiceDef[] = [
  { key: "spotify", label: "Spotify", metadataKey: "spotifyUrl", hosts: ["spotify.com"] },
  { key: "appleMusic", label: "Apple Music", metadataKey: "appleMusicUrl", hosts: ["apple.com"] },
  { key: "youtube", label: "YouTube", metadataKey: "youtubeMusicUrl", hosts: ["youtube.com", "youtu.be"] },
  { key: "bandcamp", label: "Bandcamp", metadataKey: "bandcampUrl", hosts: ["bandcamp.com"] },
  { key: "soundcloud", label: "SoundCloud", metadataKey: "soundcloudUrl", hosts: ["soundcloud.com"] },
  { key: "discogs", label: "Discogs", metadataKey: "discogsUrl", hosts: ["discogs.com"] },
];

type ParsedUrl = { ok: true; href: string; host: string } | { ok: false };

/**
 * Sanitise and parse a possibly scheme-less URL. Definitive links may arrive as
 * bare domains, so prepend `https://` when no scheme is present, then bind an
 * href only for an http(s) URL that actually parses. `host` is lowercased by
 * `URL` and has a leading `www.` stripped so service matching is scheme- and
 * subdomain-insensitive.
 *
 * Two shapes are rejected as unparseable so they render as inert text, not live
 * anchors:
 * - A protocol-relative or path-only value (`//evil.com`, `/foo`): prepending a
 *   scheme would collapse `https://` + `//evil.com` into `https:////evil.com`,
 *   which resolves to a live link to `evil.com`. A definitive link is a full URL
 *   or a bare domain, never a `/`-leading reference, so reject it outright.
 * - A single-label host (`spotify`, any bare word without a dot): `https://spotify`
 *   parses but resolves nowhere, so binding it into an href yields a dead anchor.
 *   `localhost` is the one dotless host kept parseable.
 */
export function parseListenUrl(raw: string): ParsedUrl {
  if (raw.startsWith("/")) return { ok: false };
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false };
  if (!url.hostname.includes(".") && url.hostname !== "localhost") {
    return { ok: false };
  }
  return { ok: true, href: url.href, host: url.host.replace(/^www\./, "") };
}

function serviceForHost(host: string): ServiceDef | undefined {
  return SERVICES.find((service) =>
    service.hosts.some((domain) => host === domain || host.endsWith(`.${domain}`)),
  );
}

/**
 * Fold a release's definitive (music-director) links into the metadata
 * service's Listen chips. A definitive URL whose host maps to a known service
 * **replaces** LML's link for that service; one for a service LML did not
 * return **adds** that chip; an unrecognised host is kept as a Listen entry
 * labelled by host; and a value that will not parse is kept as a non-anchor
 * entry labelled by its raw text. No provenance distinction — an overriding
 * link is just the chip.
 */
export function mergeListenLinks(
  metadata: AlbumMetadata | null,
  urls: string[] | undefined,
): ListenLink[] {
  const overrides = new Map<ServiceKey, string>();
  const extras: ListenLink[] = [];

  (urls ?? []).forEach((raw, index) => {
    const trimmed = raw?.trim();
    if (!trimmed) return;
    const parsed = parseListenUrl(trimmed);
    if (!parsed.ok) {
      extras.push({ key: `extra-${index}`, label: trimmed });
      return;
    }
    const service = serviceForHost(parsed.host);
    if (service) {
      // Last definitive URL for a service wins.
      overrides.set(service.key, parsed.href);
    } else {
      extras.push({ key: `extra-${index}`, label: parsed.host, href: parsed.href });
    }
  });

  const chips: ListenLink[] = [];
  for (const service of SERVICES) {
    const override = overrides.get(service.key);
    const lmlHref = metadata ? (metadata[service.metadataKey] as string) : "";
    const href = override ?? (lmlHref || undefined);
    if (href) chips.push({ key: service.key, label: service.label, href });
  }
  chips.push(...extras);
  return chips;
}
