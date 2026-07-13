import { Box, List, ListSubheader, Stack, Typography } from "@mui/joy";

export default function RightBarContentContainer({
  startDecorator,
  endDecorator,
  label,
  children,
  fill = false,
}: {
  startDecorator: React.ReactNode;
  endDecorator?: React.ReactNode;
  label: string;
  children: React.ReactNode;
  /**
   * When true the container claims the leftover column height and turns into a
   * flex column (with min-height:0 propagated) so a scrollable child — the Mail
   * Bin card — can fill the remaining space and scroll internally instead of
   * growing the whole rightbar past the viewport.
   */
  fill?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 2,
        pb: 3,
        ...(fill && {
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }),
      }}
    >
      <List
        sx={{
          flexGrow: 1,
          ...(fill && {
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }),
        }}
      >
        <ListSubheader
          role="presentation"
          sx={{
            color: "text.primary",
            mb: 1,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row">
            {startDecorator}
            <Typography>{label}</Typography>
          </Stack>
          {endDecorator}
        </ListSubheader>
        {children}
      </List>
    </Box>
  );
}
