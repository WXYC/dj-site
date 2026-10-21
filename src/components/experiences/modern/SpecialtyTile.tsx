import { Box } from "@mui/joy";
import type { SpecialtyShowRef } from "@wxyc/shared";
import { fitShortName } from "@/lib/features/specialty/fitShortName";

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
      <Box
        component="img"
        src={specialty.artwork.square_url}
        alt=""
        sx={{ ...square, objectFit: "cover" }}
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
      <span>
        {lines.map((line) => (
          <span key={line} style={{ display: "block", whiteSpace: "nowrap" }}>
            {line}
          </span>
        ))}
      </span>
    </Box>
  );
}
