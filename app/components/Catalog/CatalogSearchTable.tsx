'use client';
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import Checkbox from '@mui/joy/Checkbox';
import Chip from '@mui/joy/Chip';
import CircularProgress from '@mui/joy/CircularProgress';
import IconButton from '@mui/joy/IconButton';
import Link from '@mui/joy/Link';
import Sheet from '@mui/joy/Sheet';
import Table from '@mui/joy/Table';
import Typography from '@mui/joy/Typography';
import { ChangeEvent, useState } from 'react';

import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';


import { Stack, Tooltip } from '@mui/joy';

import { CatalogResult, FlowSheetEntry, Genre, OrderByOption, OrderDirectionOption, SearchInOption, applicationSlice, binSlice, catalogSlice, flowSheetSlice, getBin, getCatalogLoading, getOrderBy, getOrderDirection, getQuery, getReachedEnd, getResults, isLive, useDispatch, useSelector } from '@/lib/redux';
import Logo from '../Branding/logo';
import { ArtistAvatar } from './ArtistAvatar';
import { SearchBar } from './search/SearchBar';

/**
 * A table component for catalog search results.
 *
 * @component
 * @category Card Catalog
 * @example
 * // Usage example:
 * import CatalogSearchTable from './CatalogSearchTable';
 *
 * function App() {
 *   return (
 *     <div>
 *       <CatalogSearchTable />
 *     </div>
 *   );
 * }
 *
 * @returns {JSX.Element} The rendered CatalogSearchTable component.
 *
 * @description
 * The CatalogSearchTable component displays a table with search results from the catalog. It allows sorting the results based on different criteria, and provides options to add selected items to a queue.
 *
 * The component selects sorting algorithms on the client side and renders "add to queue" options if the DJ is live.
 */
const CatalogSearchTable = (): JSX.Element => {

    const dispatch = useDispatch();

    const live = useSelector(isLive);

    // Catalog Search State ----------------------------------------------------
    const loadMore = () => dispatch(catalogSlice.actions.loadMore());
    const loading = useSelector(getCatalogLoading);
    const searchString = useSelector(getQuery);
    const setSearchString = (value: string) => dispatch(catalogSlice.actions.setQuery(value));
    const setGenre = (value: Genre) => dispatch(catalogSlice.actions.setGenre(value));
    const setSearchIn = (value: SearchInOption) => dispatch(catalogSlice.actions.setSearchIn(value));
    const releaseList = useSelector(getResults);
    const orderBy = useSelector(getOrderBy);
    const handleRequestSort = (value: OrderByOption) => dispatch(catalogSlice.actions.setOrderBy(value));
    const orderDirection = useSelector(getOrderDirection);
    const setOrderDirection = (value: OrderDirectionOption) => dispatch(catalogSlice.actions.setOrderDirection(value));
    const reachedEndForQuery = useSelector(getReachedEnd);
    // -------------------------------------------------------------------------

  const addToQueue = (item: FlowSheetEntry) => dispatch(flowSheetSlice.actions.addToQueue(item));

  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState(false);

  const [index, setIndex] = useState(0);

  // Bin Context --------------------------------------------------------------
  const addToBin = (item: CatalogResult | undefined) => dispatch(binSlice.actions.addToBin(item));
  const removeFromBin = (item: CatalogResult) => dispatch(binSlice.actions.removeFromBin(item));
  const isInBin = (item: CatalogResult) => useSelector(getBin).includes(item);
  // -------------------------------------------------------------------------
  
const getSongCardFor = (item: CatalogResult | undefined) => dispatch(applicationSlice.actions.openSongCard(item));


  // DOES NOT YET WORK: CODE IS NOT UNIQUE
  /*const getDefaultReleaseList = async (start = 0, end = 0) => {
    const { data, error } = await (getReleaseFeed(start, end))();

    if (error) {
      toast.error(`Error During Catalog Retrieval: ${error.message}`);
    }

    if (data) {
      setReleaseList(data.releases);
      setLoading(false);
    }

  };*/

    const TableHeader = (props: TableHeaderProps) => {
      return (
        <Link
        variant="plain"
        color="neutral"
        endDecorator = {
          (orderBy === props.textValue) && (
            orderDirection === 'asc' ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />
          )
        }
        sx = {{
          padding: 0,
        }}
        onClick={() => {
          handleRequestSort(props.textValue);
        }}
      >
          {props.textValue}
      </Link>
      )
    }


      return (
        <>
          <SearchBar 
            searchString={searchString}
            setSearchString={setSearchString}
            setSearchIn={(value: SearchInOption) => {
              setSearchIn(value);
            }}
            setGenre={(value: Genre) => {
              setGenre(value);
            }}
          />
        <Sheet
          id="OrderTableContainer"
          variant="outlined"
          sx={{
            width: '100%',
            borderRadius: 'md',
            flex: 1,
            overflow: searchString.length > 0 ? 'auto' : 'hidden',
            minHeight: 0,
          }}
        >
          
          <Box
                    sx = {{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 999,
                        backdropFilter: searchString.length > 0 ? 'blur(0)' : 'blur(1rem)',
                        borderRadius: 'lg',
                        pointerEvents: searchString.length > 0 ? 'none' : 'auto',
                        transition: 'backdrop-filter 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                  <Box sx = {{ height: '80%', opacity: searchString.length > 0 ? 0 : 1, transition: 'opacity 0.2s', pb: 2 }}>
                    <Logo color='primary' />
                    <Typography color='primary' level="body-lg" sx = {{ textAlign: 'center' }}>
                      Start typing in the search bar above to explore the library!
                    </Typography>
                  </Box>
                </Box>
          <Table
            aria-labelledby="tableTitle"
            stickyHeader
            hoverRow
            sx={{
              '--TableCell-headBackground': (theme) =>
                theme.vars.palette.background.level1,
              '--Table-headerUnderlineThickness': '1px',
              '--TableRow-hoverBackground': (theme) =>
                theme.vars.palette.background.level1,                  
              '& tr > *:last-child': {
                position: 'sticky',
                right: 0,
                bgcolor: 'var(--TableCell-headBackground)',
              },
            }}
          >
            <thead>
              <tr>
                <th style={{ width: 48, textAlign: 'center', padding: 12 }}>
                  <Checkbox
                    indeterminate={
                      selected.length > 0 && selected.length !== releaseList.length
                    }
                    checked={selected.length === releaseList.length}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setSelected(
                        event.target.checked ? releaseList.map((row) => row.id) : [],
                      );
                    }}
                    color={
                      selected.length > 0 || selected.length === releaseList.length
                        ? 'primary'
                        : undefined
                    }
                    sx={{ verticalAlign: 'text-bottom' }}
                  />
                </th>
                <th style={{ width: 50, padding: 12 }}>
                </th>
                <th style={{ width: 220, padding: 12 }}>
                  <TableHeader textValue="Artist" />
                </th>
                <th style={{ width: 220, padding: 12 }}>
                  <TableHeader textValue="Title" />
                </th>
                <th style={{ width: 60, padding: 12 }}>
                 <TableHeader textValue="Code" />
                </th>
                <th style={{ width: 70, padding: 12 }}>
                  <TableHeader textValue="Format" />
                </th>
                <th style={{ width: 60, padding: 12 }}>
                  <TableHeader textValue="Plays" />
                </th>
                <th style={{ width: 120, padding: 12}}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr style={{ background: 'transparent'}}>
                  <td colSpan={8} style={{ textAlign: 'center', paddingTop: '3rem', background: 'transparent' }}>
                    <CircularProgress color="primary" size="md" />
                  </td>
                </tr>
              ) : (releaseList.map((row) => (
                <tr key={row.id}>
                  <td style={{ textAlign: 'center' }}>
                    <Checkbox
                      checked={selected.includes(row.id)}
                      color={selected.includes(row.id) ? 'primary' : undefined}
                      onChange={(event) => {
                        setSelected((ids) =>
                          event.target.checked
                            ? ids.concat(row.id)
                            : ids.filter((itemId) => itemId !== row.id),
                        );
                      }}
                      slotProps={{ checkbox: { sx: { textAlign: 'left' } } }}
                      sx={{ verticalAlign: 'text-bottom' }}
                    />
                  </td>
                  <td>
                  <ArtistAvatar
                        entry={row.album.release}
                        artist = {row.album.artist}
                        format={row.album.format}
                      />
                  </td>
                  <td>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <div>
                        <Typography
                          fontWeight="lg"
                          level="body-sm"
                          textColor="text.primary"
                        >
                          {row.album.artist.name}
                        </Typography>
                        <Typography level="body-sm">{row.album.alternate_artist?.name}</Typography>
                      </div>
                    </Box>
                  </td>
                  <td>{row.album.title}</td>
                  <td>
                    <Typography level="body-xs">
                        {row.album.artist.genre}
                    </Typography>
                    <Typography level="body-md">
                      {row.album.artist.lettercode} {row.album.artist.numbercode}/{row.album.release}
                    </Typography>
                  </td>
                  <td>
                    <Chip
                      variant="soft"
                      size="sm"
                    color={row.album.format.includes('Vinyl') ? "primary" : "warning"}
                    >
                      {row.album.format}
                    </Chip>
                  </td>
                  <td>0</td>
                    <td>
                        <Stack direction="row" gap={0.25}>
                            <Tooltip 
                            variant='outlined'
                            size="sm"
                            title="More information">
                        <IconButton
                            aria-label="More information"
                            variant="soft"
                            color="neutral"
                            size="sm"
                            onClick = {() => {
                              getSongCardFor(row);
                            }}
                        >
                            <InfoOutlinedIcon />
                        </IconButton>
                        </Tooltip>
                        {(live) && (
                            <Tooltip title="Add to Queue" placement="bottom"
                                variant="outlined"
                                size="sm"
                            >
                            <IconButton size="sm"
                                color="neutral"
                                onClick={() => addToQueue(row)}
                            >
                                <PlaylistAddIcon />
                            </IconButton>
                            </Tooltip>
                        )}
                        
                        {(!isInBin(row)) ? (<Tooltip title="Add to bin"
                            variant='outlined'
                            size="sm"
                        ><IconButton
                            aria-label="Add to bin"
                            variant="outlined"
                            color="neutral"
                            size="sm"
                            onClick = {() => {
                              addToBin(row);
                            }}
                        >
                            <DoubleArrowIcon />
                            </IconButton></Tooltip>) : (<Tooltip title="Remove from bin"
                            variant='outlined'
                            size="sm"
                        ><IconButton
                            aria-label="Remove from bin"
                            variant="outlined"
                            color="primary"
                            size="sm"
                            onClick = {() => {
                              removeFromBin(row);
                            }}
                        >
                            <DeleteOutlineOutlinedIcon />
                            </IconButton></Tooltip>)}
                        
                        </Stack>
                    </td>
                </tr>
              )))}
                {(!loading && !reachedEndForQuery) && (<tr>
                  <td colSpan={8} style={{ textAlign: 'center' }}>
                    <Button
                      variant="solid"
                      color="primary"
                      size="lg"
                      sx = {{
                        marginRight: '1rem',
                      }}
                      onClick={loadMore}
                    >
                      Load more
                    </Button>
                  </td>
                </tr>)}
            </tbody>
 
          </Table>
          {(!loading && selected.length > 0) && (<Box
                    sx={{
                      position: 'sticky',
                      bottom: 20,
                      left: 0,
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'flex-end',
                    }}
                    >
                      <Button
                        endDecorator = {<DoubleArrowIcon />}
                        variant="solid"
                        color="primary"
                        size="lg"
                        sx = {{
                          marginRight: '1rem',
                        }}
                        onClick={() =>
                          selected.map((id) => {
                            addToBin(releaseList.find((row) => row.id === id));
                          })
                        }
                        >
                          Add selected to bin
                        </Button>
                    </Box>)}
        </Sheet>
      </>
      )

}

interface TableHeaderProps {
    textValue: OrderByOption;
};

export default CatalogSearchTable;