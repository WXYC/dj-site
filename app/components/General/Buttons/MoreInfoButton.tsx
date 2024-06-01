'use client';
import IconButton, { IconButtonProps } from '@mui/joy/IconButton';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';



import { Box, Tooltip } from '@mui/joy';

import { CatalogResult, applicationSlice, useDispatch } from '@/lib/redux';
import SongCard from '../../Catalog/Reviews/SongCard';

interface MoreInfoButtonProps extends IconButtonProps {
    item: CatalogResult;
}

const MoreInfoButton = (props: MoreInfoButtonProps): JSX.Element => {
    const dispatch = useDispatch();

  const openSongCard = (item: CatalogResult) => dispatch(applicationSlice.actions.openSideBar(<SongCard songCardContent={item} />));
  
    return (
        <Tooltip title="More Info" variant='outlined' size="sm">
        <Box>
        <IconButton
          size="sm"
          color="neutral"
          onClick = {() => openSongCard(props.item)}
        >
          <InfoOutlinedIcon />
        </IconButton>
        </Box>
        </Tooltip>
    )
};


export default MoreInfoButton;