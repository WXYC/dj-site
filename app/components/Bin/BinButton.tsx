'use client';
import Box from '@mui/joy/Box';
import { IconButtonProps, Tooltip } from '@mui/joy';

import { CatalogResult, getAuthenticatedUser, getBin, useDispatch, useSelector } from '@/lib/redux';
import { deleteFromBin, insertToBin, loadBin } from '@/lib/redux/model/bin/thunks';
import { Inbox, Inventory, MoveToInbox, Outbox } from '@mui/icons-material';
import HoverIconButton from '../General/Buttons/HoverIconButton';


interface BinButtonProps extends IconButtonProps {
    entry: CatalogResult;
}

const BinButton = (props: BinButtonProps): JSX.Element => {

    const dispatch = useDispatch();
    const user = useSelector(getAuthenticatedUser);
    // Bin Context --------------------------------------------------------------
    const addToBin = (item: CatalogResult) => dispatch(insertToBin({
        entry: item,
        dj: user!
    })).finally(() => {
        dispatch(loadBin(user!.djId));
    });
    const removeFromBin = (item: CatalogResult) => dispatch(deleteFromBin(
        {
          dj: user!,
          entry: item
        }
      )).finally(() => {
        dispatch(loadBin(user!.djId));
      });
    
    const bin = useSelector(getBin);
    const isInBin = (item: CatalogResult) => bin.some((entry: CatalogResult) => entry.id === item.id);
    // -------------------------------------------------------------------------

    return (
        <Tooltip title={(isInBin(props.entry)) ? "Remove from bin" : "Add to bin"}
                            variant='outlined'
                            size="sm"
                        >
                        <Box>
                        {(!isInBin(props.entry)) ? (<HoverIconButton
                            aria-label="Add to bin"
                            variant="outlined"
                            color="neutral"
                            hoverColor='warning'
                            size="sm"
                            icon={<Inbox />}
                            hoverIcon={<MoveToInbox />}
                            onClick = {() => {
                              addToBin(props.entry);
                            }}
                            {...props}
                        />) : (<HoverIconButton
                            aria-label="Remove from bin"
                            variant="outlined"
                            color="warning"
                            size="sm"
                            onClick = {() => {
                              removeFromBin(props.entry);
                            }}
                            icon={<Inventory />}
                            hoverIcon={<Outbox />}
                            {...props}
                        />)}
                            </Box>
                            </Tooltip>
    );
}

export default BinButton;