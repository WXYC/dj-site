import ArtistLoadingAvatar from "@/src/components/modern/catalog/ArtistLoadingAvatar";
import {
  AspectRatio,
  Box,
  Card,
  CardContent,
  CardOverflow,
  ModalClose,
  Skeleton,
  Stack,
  Typography,
} from "@mui/joy";

export default function AlbumLoadingCard() {
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
          <Skeleton variant="rectangular" loading={false} />
        </AspectRatio>
        <Box
          sx={{
            position: "absolute",
            bottom: 3,
            left: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-start",
          }}
        >
          <Box
            sx={{
              ml: 5,
              width: 70,
              "& > *": {
                transform: "scale(1.8) translateY(13px)",
              },
            }}
          >
            <ArtistLoadingAvatar />
          </Box>
          <Skeleton
            variant="text"
            level="body-lg"
            height={"3em"}
            width={"8rem"}
            sx={{ ml: 3.2, mb: -1.5 }}
          />
        </Box>
        <ModalClose variant="solid" />;
      </CardOverflow>
      <CardContent>
        <CardContent>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              ml: 12,
              mb: 1,
            }}
          >
            <Typography level="body-lg">
              <Skeleton variant="text" width={"19rem"} sx={{ ml: 3 }} />
            </Typography>
          </Stack>
        </CardContent>
      </CardContent>
    </Card>
  );
}
