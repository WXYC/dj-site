import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import Logo from "@/app/components/Branding/Logo";
import ModernLoginWrapper from "@/app/components/Login/Modern/Layout/ModernLoginWrapper";
import UserForm from "@/app/components/Login/Modern/Validation/UserForm";
import { ColorSchemeToggle } from "@/app/components/Theme/ColorSchemeToggle";
import { ViewStyleToggle } from "@/app/components/Theme/ViewStyleToggle";

export default function ModernLoginPage() {
  return (
    <ModernLoginWrapper>
      <Box
        component="header"
        sx={{
          py: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box
          sx={{
            height: "clamp(2rem, 10vw, 7rem)",
          }}
        >
          <Logo />
        </Box>
        <Box>
          <ColorSchemeToggle />
          <ViewStyleToggle />
        </Box>
      </Box>
      <Box
        component="main"
        sx={{
          my: "auto",
          py: 2,
          pb: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          width: 400,
          maxWidth: "100%",
          mx: "auto",
          borderRadius: "sm",
          "& form": {
            display: "flex",
            flexDirection: "column",
            gap: 2,
          },
        }}
      >
        <UserForm />
      </Box>
      <Box component="footer" sx={{ py: 3 }}>
        <Typography level="body-sm" textAlign="center">
          © WXYC Chapel Hill {new Date().getFullYear()}
        </Typography>
      </Box>
    </ModernLoginWrapper>
  );
}
