import { useAppDispatch } from "@/lib/hooks";
import { applicationSlice } from "@/lib/slices/application";
import { Button, Sheet, Stack, Typography } from "@mui/joy";
import { Popup, PopupProps } from "./Popups";

export const NotifyPopup = ({
  message,
  ...props
}: { message: string } & PopupProps) => {
  const dispatch = useAppDispatch();

  const close = () =>
    dispatch(applicationSlice.actions.closePopup(props.uniqueId));
  return (
    <Popup {...props}>
      <Sheet color={props.style ?? "primary"}>
        <Typography level="body-lg">{message}</Typography>
        <Stack
          direction="row"
          justifyContent="flex-end"
          spacing={1}
          sx={{ mt: 3 }}
        >
          <Button
            color={props.style ?? "primary"}
            size="sm"
            variant="solid"
            onClick={close}
          >
            OK
          </Button>
        </Stack>
      </Sheet>
    </Popup>
  );
};
