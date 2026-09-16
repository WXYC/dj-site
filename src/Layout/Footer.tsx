import { Box } from "@mui/joy";
import CopyrightYear from "@/src/components/shared/CopyrightYear";


export default function Footer() {
  return (
    <Box
      component="footer"
      sx = {{
        display: "flex",
        justifyContent: "center",
        py: 3,
      }}
    >
      Copyright © <CopyrightYear /> WXYC Chapel Hill
    </Box>
  );
}
