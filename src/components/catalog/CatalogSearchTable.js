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
import React, { useContext, useEffect, useState } from 'react';

import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';

import { BinContext } from '../dashboard/bin/Bin';

import { Stack, Tooltip } from '@mui/joy';

import { toast } from 'sonner';
import { ArtistAvatar } from './ArtistAvatar';
import { SongCardContext } from './SongCardContext';
import { SearchBar } from './search/SearchBar';
import { useLive } from '../../services/flowsheet/live-context';
import { getReleasesMatching } from '../../services/card-catalog/card-catalog-service';


const TIMEOUT_MS = 800;

const sorting_algorithms_asc = {
  'Code': (a, b) => {
            let codeA = `${a.artist.genre} ${a.artist.lettercode} ${a.artist.numbercode}/${a.release_number}`;
            let codeB = `${b.artist.genre} ${b.artist.lettercode} ${b.artist.numbercode}/${b.release_number}`;
            return codeA.localeCompare(codeB);
          },
  'Title': (a, b) => (a.title < b.title) ? -1 : (a.title > b.title) ? 1 : 0,
  'Artist': (a, b) => (a.artist.name < b.artist.name) ? -1 : (a.artist.name > b.artist.name) ? 1 : 0,
  'Genre': (a, b) => (a.artist.genre < b.artist.genre) ? -1 : (a.artist.genre > b.artist.genre) ? 1 : 0,
  'Format': (a, b) => a.format.localeCompare(b.format),
}

const sorting_algorithms_desc = {
  'Code': (a, b) => {
            let codeA = `${a.artist.genre} ${a.artist.lettercode} ${a.artist.numbercode}/${a.release_number}`;
            let codeB = `${b.artist.genre} ${b.artist.lettercode} ${b.artist.numbercode}/${b.release_number}`;
            return codeB.localeCompare(codeA);
          },
  'Title': (a, b) => (b.title < a.title) ? -1 : (b.title > a.title) ? 1 : 0,
  'Artist': (a, b) => (b.artist.name < a.artist.name) ? -1 : (b.artist.name > a.artist.name) ? 1 : 0,
  'Genre': (a, b) => (b.artist.genre < a.artist.genre) ? -1 : (b.artist.genre > a.artist.genre) ? 1 : 0,
  'Format': (a, b) => b.format.localeCompare(a.format),
}

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
const OrderTable = () => {

    const { live } = useLive();

  const [releaseList, setReleaseList] = useState([]);
  const [orderBy, setOrderBy] = useState('Title');
  const [orderDirection, setOrderDirection] = useState('asc');

  const [searchString, setSearchString] = useState("");

  const [timeOut, setTimeOutState] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState([]);
  const [open, setOpen] = useState(false);

  const [reachedEndForQuery, setReachedEndForQuery] = useState(true);
  const [index, setIndex] = useState(0);

  const [searchIn, setSearchIn] = useState('Albums');
  const [genre, setGenre] = useState('All');

  const { bin, addToBin, removeFromBin, clearBin, isInBin } = useContext(BinContext);
  const { getSongCardContent } = useContext(SongCardContext);

  useEffect(() => {
    const sortReleaseList = () => {
      const sortingAlgorithm = (orderDirection === 'asc') ? sorting_algorithms_asc[orderBy] : sorting_algorithms_desc[orderBy];
      const sortedReleaseList = [...releaseList].sort(sortingAlgorithm);
      setReleaseList(sortedReleaseList);
    }

    if (!loading) sortReleaseList();

  }, [orderBy, orderDirection, loading]);

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

    const TableHeader = ({ textValue }) => {
      return (
        <Link
        variant="plain"
        color="neutral"
        size="sm"
        endDecorator = {
          (orderBy === textValue) && (
            orderDirection === 'asc' ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />
          )
        }
        sx = {{
          padding: 0,
        }}
        onClick={() => {
          handleRequestSort(textValue);
        }}
      >
          {textValue}
      </Link>
      )
    }

    const handleRequestSort = (property) => {
      if (property === orderBy) setOrderDirection(orderDirection === 'asc' ? 'desc' : 'asc');
      setOrderBy(property);
    };

    useEffect(() => {


    }, [orderBy, orderDirection]);

    useEffect(() => {
      console.log(searchString);
      if (timeOut) {
        clearTimeout(timeOut);
      }
  
      setLoading(true);
  
      setTimeOutState(
        setTimeout(async () => {
          
          if (searchString.length > 0) {
            let data = await getReleasesMatching(searchString, searchIn, genre);

            if (data != null) {
              setReleaseList(data);
            }
          }

          setLoading(false);
        }, TIMEOUT_MS)
      );
    }, [searchString, searchIn, genre]);


      return (
        <>
          <SearchBar 
            searchString={searchString}
            setSearchString={setSearchString}
            setSearchIn={(value) => {
              setSearchIn(value);
            }}
            setGenre={(value) => {
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
                        zIndex: 10000,
                        backdropFilter: searchString.length > 0 ? 'blur(0)' : 'blur(1rem)',
                        borderRadius: 'lg',
                        pointerEvents: searchString.length > 0 ? 'none' : 'auto',
                        transition: 'backdrop-filter 0.2s',
                    }}
                ></Box>
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
                    onChange={(event) => {
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
                <th style={{ width: 90, padding: 12}}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr style={{ background: 'transparent'}}>
                  <td colSpan={7} style={{ textAlign: 'center', paddingTop: '3rem', background: 'transparent' }}>
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
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <ArtistAvatar
                        entry={row.release_number}
                        artist = {row.artist}
                        format={row.format}
                      />
                      <div>
                        <Typography
                          fontWeight="lg"
                          level="body3"
                          textColor="text.primary"
                        >
                          {row.artist.name}
                        </Typography>
                        <Typography level="body3">{row.alternate_artist}</Typography>
                      </div>
                    </Box>
                  </td>
                  <td>{row.title}</td>
                  <td>
                    <Typography level="body3">
                        {row.artist.genre}
                    </Typography>
                    <Typography level="body1">
                      {row.artist.lettercode} {row.artist.numbercode}/{row.release_number}
                    </Typography>
                  </td>
                  <td>
                    <Chip
                      variant="soft"
                      size="sm"
                      color={
                        {
                          cd: 'primary',
                          vinyl: 'warning',
                        }[row.format]
                      }
                    >
                      {row.format}
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
                            color="info"
                            size="sm"
                            onClick = {() => {
                              getSongCardContent(`${row.artist.genre} ${row.artist.lettercode} ${row.artist.numbercode}/${row.release_number}`);
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
                                color="info"
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
                            color="info"
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
                  <td colSpan={7} style={{ textAlign: 'left' }}>
                    <CircularProgress color="primary" size="md" />
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
                        >
                          Add selected to bin
                        </Button>
                    </Box>)}
        </Sheet>
      </>
      )

}

export default OrderTable;