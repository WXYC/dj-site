'use client';

import React, { useContext } from 'react';
import { Button, Modal, ModalDialog, Sheet, Stack, Typography } from '@mui/joy';
import { applicationSlice, getPopupContent, getPopupState, useDispatch, useSelector } from '@/lib/redux';

interface PopupContentContextType {
    message: string;
}

interface ConfirmPopupProps extends PopupContentContextType {
    onConfirm: () => void;
}

/**
 * @component
 *
 * @description
 * The `GlobalPopups` component is responsible for rendering the global popup modal. It consumes the `PopupContentContext` to access the state of the popup and its content. The popup modal is displayed when the `open` state is `true` and the `popupContent` is rendered within the modal.
 *
 * @returns {JSX.Element} The rendered `GlobalPopups` component.
 */
export const GlobalPopups = (): JSX.Element => {
    const dispatch = useDispatch();
    const open = useSelector(getPopupState);
    const popupContent = useSelector(getPopupContent);
    const closePopup = () => dispatch(applicationSlice.actions.closePopup);

    return (
        <Modal
        open={open}
        onClose={closePopup}
    >
        <ModalDialog
            sx = {{
                transform: {
                    xs: "translate(-50%, -50%)",
                    sm: "translate(-50%, -50%)",
                    md: "translate(calc(-50% - 125px), -50%)",
                }
            }}
        >
            {popupContent}
        </ModalDialog>
    </Modal>
    )
}


/**
 * @component
 *
 * @description
 * The `ConfirmPopup` component renders a confirmation popup with a message and buttons for confirming or canceling the action. It consumes the `PopupContentContext` to access the `closePopup` function and triggers the `onConfirm` callback when the "Confirm" button is clicked.
 *
 * @param {Object} props - The component props.
 * @param {string} props.message - The message to be displayed in the confirmation popup.
 * @param {function} props.onConfirm - The callback function to be called when the "Confirm" button is clicked.
 *
 * @returns {JSX.Element} The rendered `ConfirmPopup` component.
 */
export const ConfirmPopup = (props: ConfirmPopupProps) => {

    const dispatch = useDispatch();
    const closePopup = () => dispatch(applicationSlice.actions.closePopup);

    return (
        <Sheet>
            <Typography level="body-lg" color="primary">
                {props.message}
            </Typography>
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx = {{ mt: 3 }}>
                <Button size="sm" variant="outlined" onClick={closePopup}>Cancel</Button>
                <Button size="sm" variant="solid" onClick={() => {
                    props.onConfirm();
                    closePopup();
                }}>Confirm</Button>
            </Stack>
        </Sheet>
    );
}

/**
 * @component
 * @category Popup
 *
 * @description
 * The `NotifyPopup` component renders a notification popup with a message and an "OK" button to dismiss the notification. It consumes the `PopupContentContext` to access the `closePopup` function.
 *
 * @param {Object} props - The component props.
 * @param {string} props.message - The message to be displayed in the notification popup.
 *
 * @returns {JSX.Element} The rendered `NotifyPopup` component.
 */
export const NotifyPopup = (props: PopupContentContextType) => {

    const dispatch = useDispatch();
    const closePopup = () => dispatch(applicationSlice.actions.closePopup);

    return (
        <Sheet>
            <Typography level="body-lg">
                {props.message}
            </Typography>
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx = {{ mt: 3 }}>
                <Button size="sm" variant="solid" onClick={closePopup}>OK</Button>
            </Stack>
        </Sheet>
    );
}