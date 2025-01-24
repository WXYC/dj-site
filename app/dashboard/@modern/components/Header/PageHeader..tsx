import PageData from "@/src/Layout/PageData";
import { Box, Typography } from "@mui/joy";

export default function PageHeader({ title }: { title: string }) {
  return (
    <>
      <PageData title={title} />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          my: 1,
          gap: 1,
          flexWrap: "wrap",
          "& > *": {
            minWidth: "clamp(0px, (500px - 100%) * 999, 100%)",
            flexGrow: 1,
          },
        }}
      >
        <Typography level="h1">{title}</Typography>
        <Box sx={{ flex: 999 }}></Box>
      </Box>
    </>
  );
}
