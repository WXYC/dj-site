"use client";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { User } from "@/lib/features/authentication/types";
import { useAppSelector } from "@/lib/hooks";
import EmailChangeModal from "@/src/components/experiences/modern/settings/EmailChangeModal";
import SettingsInput from "@/src/components/experiences/modern/settings/SettingsInput";
import { useDJAccount } from "@/src/hooks/djHooks";
import {
  AccountCircle,
  AlternateEmail,
  Edit,
  Email,
  TheaterComedy,
} from "@mui/icons-material";
import BadgeIcon from "@mui/icons-material/Badge";
import { IconButton, Modal, Stack, Tooltip } from "@mui/joy";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import CardActions from "@mui/joy/CardActions";
import CardContent from "@mui/joy/CardContent";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Typography from "@mui/joy/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SettingsPopup({ user }: { user: User }) {
  const router = useRouter();
  const [emailModalOpen, setEmailModalOpen] = useState(false);

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
          <FormControl sx={{ gridColumn: "1/-1" }}>
            <FormLabel>Username</FormLabel>
            <Input
              disabled
              endDecorator={<AlternateEmail />}
              value={user.username}
            />
          </FormControl>
          <FormControl sx={{ gridColumn: "1/-1" }}>
            <FormLabel>Personal Name</FormLabel>
            <SettingsInput
              name="realName"
              backendValue={user.realName}
              endDecorator={<BadgeIcon />}
            />
          </FormControl>
          <FormControl sx={{ gridColumn: "1/-1" }}>
            <FormLabel>DJ Name</FormLabel>
            <SettingsInput
              name="djName"
              backendValue={user.djName}
              endDecorator={<TheaterComedy />}
            />
          </FormControl>
          <FormControl sx={{ gridColumn: "1/-1" }}>
            <FormLabel>Email</FormLabel>
            <Stack direction="row" spacing={1} alignItems="center">
              <Input
                disabled
                value={user.email}
                endDecorator={<Email />}
                sx={{ flex: 1 }}
              />
              <Tooltip
                title="Change your email address"
                arrow
                placement="top"
                variant="outlined"
                size="sm"
              >
                <IconButton
                  size="sm"
                  variant="outlined"
                  color="primary"
                  onClick={() => setEmailModalOpen(true)}
                >
                  <Edit />
                </IconButton>
              </Tooltip>
            </Stack>
            <FormHelperText>
              Changing your email requires verification via the new address.
            </FormHelperText>
          </FormControl>
          <EmailChangeModal
            open={emailModalOpen}
            onClose={() => setEmailModalOpen(false)}
            currentEmail={user.email}
          />
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
