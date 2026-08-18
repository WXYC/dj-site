import { AlbumMetadata } from "@/lib/features/metadata/types";
import { Chip, Stack } from "@mui/joy";

interface StreamingLinksProps {
  metadata: AlbumMetadata | null;
}

const SERVICES: { key: keyof AlbumMetadata; label: string }[] = [
  { key: "spotifyUrl", label: "Spotify" },
  { key: "appleMusicUrl", label: "Apple Music" },
  { key: "youtubeMusicUrl", label: "YouTube" },
  { key: "bandcampUrl", label: "Bandcamp" },
  { key: "soundcloudUrl", label: "SoundCloud" },
  { key: "discogsUrl", label: "Discogs" },
];

export default function StreamingLinks({ metadata }: StreamingLinksProps) {
  if (!metadata) return null;

  const links = SERVICES.filter(
    (service) => metadata[service.key] as string,
  );

  if (links.length === 0) return null;

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
      {links.map((service) => (
        <Chip
          key={service.key}
          variant="outlined"
          size="sm"
          component="a"
          href={metadata[service.key] as string}
          target="_blank"
          rel="noopener noreferrer"
        >
          {service.label}
        </Chip>
      ))}
    </Stack>
  );
}
