import PageData from "@/src/Layout/PageData";
import { Box, Typography } from "@mui/joy";

const PageHeader = ({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}): JSX.Element => {
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
        <Typography level="h2">{title}</Typography>
        <Box sx={{ flex: 999 }}></Box>
        {children}
      </Box>
    </>
  );
};

export default PageHeader;
