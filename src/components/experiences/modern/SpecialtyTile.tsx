import { Box, styled } from "@mui/joy";
import type { SpecialtyShowRef } from "@wxyc/shared";
import { fitShortName } from "@/lib/features/specialty/fitShortName";

/**
 * The artwork image. Joy's `Box` reads `width` and `height` as CSS style props
 * and never forwards them, so the element would carry no `width`/`height`
 * attributes; a styled native `img` keeps them as real attributes, which size
 * the image and let the browser reserve its box before the lazy load.
 */
const ArtworkImage = styled("img")(({ theme }) => ({
  flexShrink: 0,
  borderRadius: theme.vars.radius.sm,
  objectFit: "cover",
}));

/**
 * A specialty program's tile: its logo when it has one, else `short_name` set
 * on `accent_color`. The typographic form is drawn locally so a program without
 * artwork costs no image request. White text on the accent is safe in both
 * themes because the catalog refuses a color that does not reach 4.5:1.
 */
export default function SpecialtyTile({
  specialty,
  size,
}: {
  specialty: SpecialtyShowRef;
  size: number;
}) {
  const square = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: "sm",
  } as const;

  if (specialty.artwork) {
    return (
      <ArtworkImage
        src={specialty.artwork.square_url}
        alt=""
        loading="lazy"
        width={size}
        height={size}
      />
    );
  }

  const { lines, fontSize } = fitShortName(specialty.short_name, size);

  return (
    <Box
      data-testid="specialty-tile"
      aria-hidden
      sx={{
        ...square,
        bgcolor: specialty.accent_color ?? "neutral.solidBg",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "lg",
        fontSize,
        lineHeight: 1.02,
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      {lines.length > 0 && (
        <span>
          {lines.map((line) => (
            <span key={line} style={{ display: "block", whiteSpace: "nowrap" }}>
              {line}
            </span>
          ))}
        </span>
      )}
    </Box>
  );
}
