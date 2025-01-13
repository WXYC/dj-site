import { Box } from "@mui/joy";
import { ColorSchemeToggle } from "../../Theme/ColorSchemeToggle";
import { ViewStyleToggle } from "../../Theme/ViewStyleToggle";

export default function DesktopHeader() {
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Box sx={{ ml: "auto", display: { xs: "none", md: "inline-flex" } }}>
        <ColorSchemeToggle />
        <ViewStyleToggle />
      </Box>
    </Box>
  );
}
