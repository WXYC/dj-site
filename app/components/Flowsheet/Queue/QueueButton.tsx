'use client';
import Box from '@mui/joy/Box';
import { IconButtonProps, Tooltip } from '@mui/joy';

import { CatalogResult, FlowSheetEntry, flowSheetSlice, getQueue, isLive, useDispatch, useSelector } from '@/lib/redux';
import { PlaylistAdd, PlaylistAddCheck, PlaylistRemove, QueueMusic } from '@mui/icons-material';
import HoverIconButton from '../../General/Buttons/HoverIconButton';

interface QueueButtonProps extends IconButtonProps {
    entry: CatalogResult;
}

const QueueButton = (props: QueueButtonProps): JSX.Element => {

    const dispatch = useDispatch();
    const live = useSelector(isLive);

    // FlowSheet Context --------------------------------------------------------
    const queue = useSelector(getQueue);
    const addToQueue = (item: CatalogResult) => dispatch(flowSheetSlice.actions.addToQueue(item));
    const removeFromQueue = (id: number) => dispatch(flowSheetSlice.actions.removeFromQueue(id));
    const isInQueue = (item: CatalogResult) => queue.some((entry: FlowSheetEntry) => entry.catalog_id === item.id);
    // -------------------------------------------------------------------------

    return <Tooltip 
            variant='outlined'
            size="sm"
            title={!live ? "Not Live" : (isInQueue(props.entry)) ? "Remove from queue" : "Add to queue"}>
              <Box>
            {(!isInQueue(props.entry)) ? (
              <HoverIconButton
              variant='outlined'
                  size="sm"
                  color="neutral"
                  hoverColor='success'
                  onClick={() => addToQueue(props.entry)}
                  icon={<QueueMusic />}
                  hoverIcon={<PlaylistAdd />}
                  disabled={!live}
                  {...props}
              />
          ) : (
        <HoverIconButton
            variant='outlined'
            size="sm"
            color="success"
            hoverColor='primary'
            onClick={() => removeFromQueue(props.entry.id)}
            icon={<PlaylistAddCheck />}
            hoverIcon={<PlaylistRemove />}
            disabled={!live}
            {...props}
        />
          )}
          </Box>
            </Tooltip>
};

export default QueueButton;