import React, { useContext } from 'react';
import { PopupContentContext } from '../../../pages/dashboard/Popup';
import { Button, Sheet, Stack, Typography } from '@mui/joy';

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