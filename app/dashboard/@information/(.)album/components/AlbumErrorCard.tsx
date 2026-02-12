"use client";

import {
  AspectRatio,
  Button,
  Card,
  CardContent,
  CardOverflow,
  Divider,
  ModalClose,
  Stack,
  Typography,
} from "@mui/joy";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AlbumErrorCard() {
  const router = useRouter();

  return (
    <Card
      variant="outlined"
      sx={{
        width: "50%",
        height: 500,
      }}
    >
      <CardOverflow>
        <AspectRatio ratio="4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/wxyc_dark.jpg" alt="WXYC logo" />
        </AspectRatio>
        <ModalClose variant="solid" />;
      </CardOverflow>
      <CardContent>
        <CardContent>
          <Stack
            direction="column"
            spacing={2}
            sx={{ justifyContent: "center", alignItems: "center" }}
          >
            <Typography level="h1">Ack!</Typography>
            <Typography level="body-lg">
              We could not load the album you were looking for. Please try again
              later.
            </Typography>
            <Divider />
            <Stack direction="column" spacing={2} sx={{ width: "80%" }}>
              <Button variant="solid" onClick={() => router.back()} fullWidth>
                Go Back
              </Button>
              <Link href="https://forms.gle/VCw43XejNte27Bef7" target="_blank" style={{ width: "100%" }}>
                <Button variant="outlined" fullWidth>
                  Report Issue
                </Button>
              </Link>
            </Stack>
          </Stack>
        </CardContent>
      </CardContent>
    </Card>
  );
}
