'use client';
import Box from '@mui/joy/Box';
import { IconButtonProps, Tooltip } from '@mui/joy';

import { CatalogResult, FlowSheetEntry, flowSheetSlice, getQueue, isLive, useDispatch, useSelector } from '@/lib/redux';
import { PlayArrow, PlaylistAdd, PlaylistRemove, QueueMusic } from '@mui/icons-material';
import HoverIconButton from '../../General/Buttons/HoverIconButton';
import { useCallback } from 'react';

interface PlayButtonProps extends IconButtonProps {
    entry: CatalogResult;
}

const PlayButton = (props: PlayButtonProps): JSX.Element => {

    const dispatch = useDispatch();
    const live = useSelector(isLive);

    // FlowSheet Context --------------------------------------------------------
    const queue = useSelector(getQueue);
    const removeFromQueue = (item: CatalogResult) => dispatch(flowSheetSlice.actions.removeCatalogEntryFromQueue(item));
    const isInQueue = (item: CatalogResult) => queue.some((entry: FlowSheetEntry) => entry.id === item.id);
    const play = (item: CatalogResult) => {
        if (isInQueue(item)) {
            removeFromQueue(item);
        }
        dispatch(flowSheetSlice.actions.addToEntries(item));
    }
    // -------------------------------------------------------------------------

    return <Tooltip 
            variant='outlined'
            size="sm"
            title={live ? "Play Now" : "Not Live"}
            >
              <Box>
              <HoverIconButton
              variant='outlined'
                  size="sm"
                  color="neutral"
                  hoverColor='primary'
                  onClick={() => play(props.entry)}
                  icon={<PlayArrow />}
                  hoverIcon={<PlayArrow />}
                  disabled={!live}
                  {...props}
              />
          </Box>
            </Tooltip>
};

export default PlayButton;