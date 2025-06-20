"use client";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { useAppSelector } from "@/lib/hooks";
import { useDJAccount } from "@/src/hooks/djHooks";
import { AccountCircle } from "@mui/icons-material";
import { Modal } from "@mui/joy";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import CardActions from "@mui/joy/CardActions";
import CardContent from "@mui/joy/CardContent";
import Divider from "@mui/joy/Divider";
import Typography from "@mui/joy/Typography";
import { useRouter } from "next/navigation";

export default function CreateAccountPopup() {
  const router = useRouter();

  const modified = useAppSelector(authenticationSlice.selectors.isModified);
  const { info, loading, handleSaveData } = useDJAccount();

  return (
    <Modal
      open={true}
      onClose={() => router.back()}
      sx={{
        zIndex: 90000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Card
        variant="outlined"
        sx={{
          maxHeight: "max-content",
          maxWidth: "100%",
          mx: "auto",
          // to make the demo resizable
          overflow: "auto",
          resize: "horizontal",
        }}
      >
        <Typography level="title-lg" startDecorator={<AccountCircle />}>
          Your Information
        </Typography>
        <Divider inset="none" />
        <CardContent
          component="form"
          onSubmit={handleSaveData}
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(1, minmax(80px, 1fr))",
            gap: 1.5,
          }}
        >
          <CardActions sx={{ gridColumn: "1/-1" }}>
            <Button
              variant="solid"
              color="primary"
              loading={loading}
              disabled={!modified}
              type="submit"
            >
              Save
            </Button>
          </CardActions>
        </CardContent>
      </Card>
    </Modal>
  );
}
