import { getAuthenticatedUser, useSelector } from "@/lib/redux";
import {
    Card,
    CardContent,
    Chip,
    Stack,
    Typography
} from "@mui/joy";

interface ReviewProps {
  username: string;
  content: string;
  recommends: number[];
}

export function Review(props: ReviewProps): JSX.Element {
  const user = useSelector(getAuthenticatedUser);

  return (
    <Card
      variant={props.username == user?.username ? "solid" : "outlined"}
      color={props.username == user?.username ? "primary" : "danger"}
      invertedColors={props.username == user?.username}
      sx={{
        width: "100%",
        boxShadow: "lg",
      }}
    >
      <CardContent>
        <Stack direction="column" sx={{ p: 0.2 }}>
          <Typography level="title-sm" sx={{ mb: 1 }}>
            @{props.username}
          </Typography>
          <Typography
            level="body-xs"
            sx={{
              color: props.username == user?.username ? "white" : "inherit",
            }}
          >
            {props.content}
          </Typography>
        </Stack>
      </CardContent>
      {props.recommends.length > 0 && (
        <Stack direction="row" spacing={1}>
          <Typography
            level="body-xs"
            sx={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              fontSize: "0.5rem",
            }}
          >
            PLAY
          </Typography>
          {props.recommends.map((track, index) => (
            <Chip key={index} variant="outlined" size="sm">
              {track}
            </Chip>
          ))}
        </Stack>
      )}
    </Card>
  );
}
