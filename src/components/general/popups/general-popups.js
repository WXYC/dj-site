import React, { useContext } from 'react';
import { PopupContentContext } from '../../../pages/dashboard/Popup';
import { Button, Sheet, Stack, Typography } from '@mui/joy';

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
export const ConfirmPopup = ({ message, onConfirm }) => {

    const { closePopup } = useContext(PopupContentContext);

    return (
        <Sheet>
            <Typography variant="body1" color="primary">
                {message}
            </Typography>
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx = {{ mt: 3 }}>
                <Button size="sm" variant="outlined" onClick={closePopup}>Cancel</Button>
                <Button size="sm" variant="solid" onClick={() => {
                    onConfirm();
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
export const NotifyPopup = ({ message }) => {

    const { closePopup } = useContext(PopupContentContext);

    return (
        <Sheet>
            <Typography variant="body1">
                {message}
            </Typography>
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx = {{ mt: 3 }}>
                <Button size="sm" variant="solid" onClick={closePopup}>OK</Button>
            </Stack>
        </Sheet>
    );
}