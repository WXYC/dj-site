"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { applicationSlice } from "@/lib/slices/application";
import { getPopupState } from "@/lib/slices/application/selectors";
import { ColorPaletteProp, Modal, ModalDialog, ModalOwnProps } from "@mui/joy";

export interface PopupProps extends Omit<ModalOwnProps, "open" | "children"> {
  uniqueId: string;
  style?: ColorPaletteProp;
}

export const Popup = ({
  uniqueId,
  style,
  ...props
}: React.PropsWithChildren<PopupProps>): JSX.Element => {
  const isOpen = Boolean(useAppSelector((state) => getPopupState(state, uniqueId)));

  const dispatch = useAppDispatch();
  const close = () =>
    dispatch(applicationSlice.actions.closePopup(uniqueId));

  return (
    <Modal {...props} open={isOpen} onClose={close}>
      <ModalDialog
        color={style ?? "primary"}
        sx={{
          transform: {
            xs: "translate(-50%, -50%)",
            sm: "translate(-50%, -50%)",
            md: "translate(-50%, -50%)",
          },
        }}
      >
        {props.children}
      </ModalDialog>
    </Modal>
  );
};
