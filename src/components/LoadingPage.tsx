import { Box, CircularProgress, Modal } from "@mui/joy";
import { createServerSideProps } from "../../lib/features/session";

export const LoadingPage = (): JSX.Element => {
  return (
    <Modal open={true}>
      <Box>
        <CircularProgress />
      </Box>
    </Modal>
  );
};
