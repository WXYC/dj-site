"use client";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { User } from "@/lib/features/authentication/types";
import { useAppSelector } from "@/lib/hooks";
import SettingsInput from "@/src/components/experiences/modern/settings/SettingsInput";
import SettingsTextarea from "@/src/components/experiences/modern/settings/SettingsTextarea";
import { useDJAccount } from "@/src/hooks/djHooks";
import {
  AccountCircle,
  AlternateEmail,
  Email,
  TheaterComedy,
  RecordVoiceOver,
  VolumeUp,
  Schedule,
  Work,
  School,
  Notes,
  LocationOn,
} from "@mui/icons-material";
import BadgeIcon from "@mui/icons-material/Badge";
import { Modal } from "@mui/joy";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import CardActions from "@mui/joy/CardActions";
import CardContent from "@mui/joy/CardContent";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Typography from "@mui/joy/Typography";
import { useRouter } from "next/navigation";

export default function SettingsPopup({ user }: { user: User }) {
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
          maxHeight: "90vh",
          maxWidth: "600px",
          width: "100%",
          mx: "auto",
          overflow: "auto",
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
            gridTemplateColumns: "repeat(2, minmax(80px, 1fr))",
            gap: 1.5,
          }}
        >
          {/* Identity Section */}
          <Typography level="title-sm" sx={{ gridColumn: "1/-1" }}>
            Identity
          </Typography>
          <FormControl sx={{ gridColumn: "1/-1" }}>
            <FormLabel>Username</FormLabel>
            <Input
              disabled
              endDecorator={<AlternateEmail />}
              value={user.username}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Personal Name</FormLabel>
            <SettingsInput
              name="realName"
              backendValue={user.realName}
              endDecorator={<BadgeIcon />}
            />
          </FormControl>
          <FormControl>
            <FormLabel>DJ Name</FormLabel>
            <SettingsInput
              name="djName"
              backendValue={user.djName}
              endDecorator={<TheaterComedy />}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Pronouns</FormLabel>
            <SettingsInput
              name="pronouns"
              backendValue={user.pronouns}
              endDecorator={<RecordVoiceOver />}
              placeholder="e.g., they/them"
            />
          </FormControl>
          <FormControl>
            <FormLabel>Name Pronunciation</FormLabel>
            <SettingsInput
              name="namePronunciation"
              backendValue={user.namePronunciation}
              endDecorator={<VolumeUp />}
              placeholder="e.g., JAY-kub"
            />
          </FormControl>

          <Divider sx={{ gridColumn: "1/-1", my: 1 }} />

          {/* Station Info Section */}
          <Typography level="title-sm" sx={{ gridColumn: "1/-1" }}>
            Station Info
          </Typography>
          <FormControl>
            <FormLabel>Title</FormLabel>
            <SettingsInput
              name="title"
              backendValue={user.title}
              endDecorator={<Work />}
              placeholder="e.g., Music Director"
            />
          </FormControl>
          <FormControl>
            <FormLabel>Show Times</FormLabel>
            <SettingsInput
              name="showTimes"
              backendValue={user.showTimes}
              endDecorator={<Schedule />}
              placeholder="e.g., Fridays 2-4pm"
            />
          </FormControl>
          <FormControl>
            <FormLabel>Semester Hired</FormLabel>
            <SettingsInput
              name="semesterHired"
              backendValue={user.semesterHired}
              endDecorator={<School />}
              placeholder="e.g., Fall 2024"
            />
          </FormControl>

          <Divider sx={{ gridColumn: "1/-1", my: 1 }} />

          {/* About Section */}
          <Typography level="title-sm" sx={{ gridColumn: "1/-1" }}>
            About
          </Typography>
          <FormControl sx={{ gridColumn: "1/-1" }}>
            <FormLabel>Bio</FormLabel>
            <SettingsTextarea
              name="bio"
              backendValue={user.bio}
              placeholder="Tell us about yourself..."
            />
          </FormControl>
          <FormControl>
            <FormLabel>Location</FormLabel>
            <SettingsInput
              name="location"
              backendValue={user.location}
              endDecorator={<LocationOn />}
              placeholder="e.g., Chapel Hill, NC"
            />
          </FormControl>
          <FormControl>
            <FormLabel>Email</FormLabel>
            <SettingsInput
              name="email"
              backendValue={user.email}
              endDecorator={<Email />}
              disabled
            />
          </FormControl>

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
