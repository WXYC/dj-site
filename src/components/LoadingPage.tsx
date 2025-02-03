import { Box, CircularProgress, Modal } from "@mui/joy";

export const LoadingPage = (): JSX.Element => {
  return (
    <Modal open={true}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          width: "100vw",
        }}
      >
        <CircularProgress />
      </Box>
    </Modal>
  );
};
