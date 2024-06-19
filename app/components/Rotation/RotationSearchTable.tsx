'use client';
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import Chip from '@mui/joy/Chip';
import CircularProgress from '@mui/joy/CircularProgress';
import IconButton from '@mui/joy/IconButton';
import Table from '@mui/joy/Table';
import Typography from '@mui/joy/Typography';
import { useEffect, useState } from 'react';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';



import { ButtonGroup, Stack, Tooltip } from '@mui/joy';

import { rotationStyles } from '@/app/styles/rotation/RotationStyles';
import { Artist, CatalogResult, Genre, ROTATIONS, applicationSlice, catalogSlice, getCatalogLoading, getEditedSong, getGenre, getN, getOrderBy, getOrderDirection, getQuery, getReachedEnd, getResults, getRotation, getRotationLoading, getSearchIn, searchCatalog, useDispatch, useSelector } from '@/lib/redux';
import { Add, SyncDisabled } from '@mui/icons-material';
import AddToCatalog from '../Catalog/AddToCatalog';
import { ArtistAvatar } from '../Catalog/ArtistAvatar';
import SongCard from '../Catalog/Reviews/SongCard';
import { SearchBar } from '../Catalog/Search/SearchBar';
import TableHeader from '../Table/TableHeader';
import { OrderByOption, OrderDirectionOption, SearchInOption } from '../Table/types';
import { convertFormat } from '@/lib/services/catalog/conversions';


const RotationSearchTable = () => {
    const dispatch = useDispatch(); 

    const editedSong = useSelector(getEditedSong);

    // Rotation Search State ----------------------------------------------------
    const loadMore = () => dispatch(catalogSlice.actions.loadMore());
    const catalogLoading = useSelector(getCatalogLoading);
    const rotationLoading = useSelector(getRotationLoading);
    const searchString = useSelector(getQuery);
    const setSearchString = (value: string) => dispatch(catalogSlice.actions.setQuery(value));
    const genre = useSelector(getGenre);
    const setGenre = (value: Genre) => dispatch(catalogSlice.actions.setGenre(value));
    const searchIn = useSelector(getSearchIn);
    const setSearchIn = (value: SearchInOption) => dispatch(catalogSlice.actions.setSearchIn(value));
    const rotationList = useSelector(getRotation);
    const catalogList = useSelector(getResults);
    const orderBy = useSelector(getOrderBy);
    const handleRequestSort = (value: OrderByOption) => dispatch(catalogSlice.actions.setOrderBy(value));
    const orderDirection = useSelector(getOrderDirection);
    const setOrderDirection = (value: OrderDirectionOption) => dispatch(catalogSlice.actions.setOrderDirection(value));
    const reachedEndForQuery = useSelector(getReachedEnd);
    const n = useSelector(getN);
    // -------------------------------------------------------------------------

    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | undefined>(undefined);
    const getSongCardFor = (item: CatalogResult | undefined) => dispatch(applicationSlice.actions.openSideBar(<SongCard songCardContent={item} />));

    const handleRotationChange = (row: CatalogResult, rotation: string) => {
      console.table(row);
      console.log(rotation);
    };

    useEffect(() => {
      if (reachedEndForQuery) return;

      clearTimeout(searchTimeout);
      setSearchTimeout(setTimeout(() => {
        dispatch(searchCatalog({
          term: searchString,
          medium: searchIn,
          genre: genre,
          n: n
        }));
      }, 500));
    }, [searchString, searchIn, genre, n]);

    return (
        <Box>
          <SearchBar
            searchString={searchString}
            setSearchString={setSearchString}
            setSearchIn={(value: SearchInOption) => {
              setSearchIn(value);
            }}
            setGenre={(value: Genre) => {
              setGenre(value);
            }}
            color="success"
          />
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
            <th style={{ width: 60, padding: 12 }}>
            </th>
            <th style={{ width: 220, padding: 12 }}>
              <TableHeader
                textValue="Artist"
                orderBy={orderBy}
                orderDirection={orderDirection}
                handleRequestSort={handleRequestSort}
              />
            </th>
            <th style={{ width: 220, padding: 12 }}>
              <TableHeader 
                textValue="Title" 
                orderBy={orderBy}
                orderDirection={orderDirection}
                handleRequestSort={handleRequestSort}
              />
            </th>
            <th style={{ width: 60, padding: 12 }}>
             <TableHeader 
              textValue="Code" 
              orderBy={orderBy}
              orderDirection={orderDirection}
              handleRequestSort={handleRequestSort}  
            />
            </th>
            <th style={{ width: 70, padding: 12 }}>
              <TableHeader 
                textValue="Format" 
                orderBy={orderBy}
                orderDirection={orderDirection}
                handleRequestSort={handleRequestSort}
              />
            </th>
            <th style={{ width: 60, padding: 12 }}>
              <TableHeader 
                textValue="Plays" 
                orderBy={orderBy}
                orderDirection={orderDirection}
                handleRequestSort={handleRequestSort}
              />
            </th>
            <th style={{ width: 250 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <IconButton
                  size="sm"
                  variant="solid"
                  color="success"
                  onClick={() => dispatch(applicationSlice.actions.openSideBar(
                    <AddToCatalog />
                  ))}
                >
                  <Add />
                </IconButton>
              </Box>
            </th>
          </tr>
        </thead>
        <tbody>
          {(editedSong && (
            <tr key={`${(searchString === '') ? "rotation" : "catalog"}-editedSong`}
              style={{ borderBottom: '1px solid #e0e0e0' }}
            >
            <td>
            <ArtistAvatar
                  entry={editedSong?.album?.release}
                  artist = {editedSong?.album?.artist as Artist}
                  format={convertFormat(editedSong?.album?.format ?? "")}
                  rotation={editedSong?.album?.rotation}
                />
            </td>
            <td>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <div>
                  <Typography
                    fontWeight="lg"
                    level="body-sm"
                    textColor="text.success"
                  >
                    {editedSong?.album?.artist?.name}
                  </Typography>
                  <Typography level="body-sm">{editedSong?.album?.alternate_artist?.name}</Typography>
                </div>
              </Box>
            </td>
            <td>{editedSong?.album?.title}</td>
            <td>
              <Typography level="body-xs">
                  {editedSong?.album?.artist?.genre}
              </Typography>
              <Typography level="body-md">
                {editedSong?.album?.artist?.lettercode} {editedSong?.album?.artist?.numbercode}/{editedSong?.album?.release}
              </Typography>
            </td>
            <td>
              <Chip
                variant="soft"
                size="sm"
                color={editedSong?.album?.format?.includes('Vinyl') ? "success" : "warning"}
              >
                {convertFormat(editedSong?.album?.format ?? "")}
              </Chip>
            </td>
            <td>0</td>
              <td>
                  <Stack direction="row" gap={0.25}
                      sx = {{ display: 'flex', justifyContent: 'space-between' }}
                  >
                  <Stack direction="row" gap={0.25}>
                  <ButtonGroup>
                      {(ROTATIONS.map((rotation) => (
                          <Button
                              key={`${(searchString === '') ? "rotation" : "catalog"}-editedSong-btn`}
                              variant={rotation === editedSong?.album?.rotation ? 'solid' : 'outlined'}
                              color={rotation === editedSong?.album?.rotation ? rotationStyles[editedSong?.album?.rotation] : 'neutral'}
                              size="sm"
                              onClick={() => {
                                // DO SOMETHING
                              }}
                          >
                              {rotation}
                          </Button>
                      )))}
                  </ButtonGroup>
                  <Tooltip 
                      variant='outlined'
                      size="sm"
                      title="Remove From Rotation">
                  <IconButton
                      aria-label="Remove From Rotation"
                      variant="solid"
                      color="danger"
                      disabled={editedSong?.album?.rotation === undefined}
                      size="sm"
                      onClick = {() => {
                        // DO SOMETHING
                      }}
                      sx = {{ ml: 0.5 }}
                  >
                      <SyncDisabled />
                  </IconButton>
                  </Tooltip>
                  </Stack>
                  <Tooltip 
                      variant='outlined'
                      size="sm"
                      title="More information">
                  <IconButton
                      aria-label="More information"
                      variant="soft"
                      color="neutral"
                      size="sm"
                      disabled
                  >
                      <InfoOutlinedIcon />
                  </IconButton>
                  </Tooltip>
                  </Stack>
              </td>
            </tr>
          ))}
          {(rotationLoading || catalogLoading) ? (
            <tr style={{ background: 'transparent'}}>
              <td colSpan={7} style={{ textAlign: 'center', paddingTop: '3rem', background: 'transparent' }}>
                <CircularProgress color="success" size="md" />
              </td>
            </tr>
          ) : ((searchString === '' ? rotationList : catalogList).map((row, index) => (
            <tr key={`${(searchString === '') ? "rotation" : "catalog"}-${row.id}-${index}`}>
              <td>
              <ArtistAvatar
                    entry={row.album.release}
                    artist = {row.album.artist}
                    format={row.album.format}
                    rotation={row.album.rotation}
                  />
              </td>
              <td>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <div>
                    <Typography
                      fontWeight="lg"
                      level="body-sm"
                      textColor="text.success"
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
                color={row.album.format.includes('Vinyl') ? "success" : "warning"}
                >
                  {row.album.format}
                </Chip>
              </td>
              <td>0</td>
                <td>
                    <Stack direction="row" gap={0.25}
                        sx = {{ display: 'flex', justifyContent: 'space-between' }}
                    >
                    <Stack direction="row" gap={0.25}>
                    <ButtonGroup>
                        {(ROTATIONS.map((rotation) => (
                            <Button
                                key={`${(searchString === '') ? "rotation" : "catalog"}-${row.id}-${rotation}-btn`}
                                variant={rotation === row.album.rotation ? 'solid' : 'outlined'}
                                color={rotation === row.album.rotation ? rotationStyles[row.album.rotation] : 'neutral'}
                                size="sm"
                                onClick={() => {
                                  handleRotationChange(row, rotation);
                                }}
                            >
                                {rotation}
                            </Button>
                        )))}
                    </ButtonGroup>
                    <Tooltip 
                        variant='outlined'
                        size="sm"
                        title="Remove From Rotation">
                    <IconButton
                        aria-label="Remove From Rotation"
                        variant="solid"
                        color="danger"
                        disabled={row.album.rotation === undefined}
                        size="sm"
                        onClick = {() => {
                          getSongCardFor(row);
                        }}
                        sx = {{ ml: 0.5 }}
                    >
                        <SyncDisabled />
                    </IconButton>
                    </Tooltip>
                    </Stack>
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
                    </Stack>
                </td>
            </tr>
          )))}
          {(!catalogLoading && !rotationLoading && !reachedEndForQuery && searchString !== '') && (<tr>
                  <td colSpan={7} style={{ textAlign: 'center' }}>
                    <Button
                      variant="solid"
                      color="success"
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
      </Box>
    );
}

export default RotationSearchTable;