import { useAppDispatch } from "@/lib/hooks";
import { applicationSlice } from "@/lib/slices/application";
import { Button, Sheet, Stack, Typography } from "@mui/joy";
import { Popup, PopupProps } from "./Popups";

export const ConfirmPopup = ({
  message,
  onConfirm,
  ...props
}: { message: string; onConfirm: () => void } & PopupProps) => {
  const dispatch = useAppDispatch();

  const close = () =>
    dispatch(applicationSlice.actions.closePopup(props.uniqueId));

  return (
    <Popup {...props}>
      <Sheet>
        <Typography level="body-lg" color={props.style ?? "primary"}>
          {message}
        </Typography>
        <Stack
          direction="row"
          justifyContent="flex-end"
          spacing={1}
          sx={{ mt: 3 }}
        >
          <Button
            color={props.style ?? "primary"}
            size="sm"
            variant="outlined"
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            color={props.style ?? "primary"}
            size="sm"
            variant="solid"
            onClick={() => {
              if (onConfirm) {
                onConfirm();
              }
              close();
            }}
          >
            Confirm
          </Button>
        </Stack>
      </Sheet>
    </Popup>
  );
};
