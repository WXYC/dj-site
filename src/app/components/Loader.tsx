import { Box, CircularProgress, Modal } from "@mui/joy";

export default function Loader() {
  return (
    <Modal open={true} style={{ zIndex: 10000 }}>
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <CircularProgress />
      </Box>
    </Modal>
  );
}
