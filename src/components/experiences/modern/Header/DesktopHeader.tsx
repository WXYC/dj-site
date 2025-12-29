import { Box } from "@mui/joy";

export default function DesktopHeader() {
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Box
        sx={{ ml: "auto", display: { xs: "none", md: "inline-flex" } }}
      ></Box>
    </Box>
  );
}
