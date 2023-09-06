import { AspectRatio, Box, Button, Input, Sheet, Table, useTheme, Link, FormControl, FormLabel, Select, Option } from "@mui/joy";
import Checkbox from '@mui/joy/Checkbox';
import Chip from '@mui/joy/Chip';
import CircularProgress from '@mui/joy/CircularProgress';
import IconButton from '@mui/joy/IconButton';
import Typography from '@mui/joy/Typography';
import { ClickAwayListener } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useCatalog } from "../../../services/card-catalog/card-catalog-context";
import { SearchBar } from "../../catalog/search/SearchBar";

import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';

import { Stack, Tooltip } from '@mui/joy';

import { ArtistAvatar } from "../../catalog/ArtistAvatar";
import { Edit } from "@mui/icons-material";

export const CatalogEditor = (props) => {

    const [editing, setEditing] = useState(false);
    const [edited, setEdited] = useState(false);

    const [song, setSong] = useState({});
    const [editedSong, setEditedSong] = useState({});
    const [editList, setEditList] = useState({
      title: false,
    });

    const { palette } = useTheme();

    const { 
        loadMore,
        searchString, 
        setSearchString, 
        setSearchIn,
        setGenre,
        loading, 
        releaseList, 
        orderBy, 
        setOrderBy, 
        orderDirection, 
        setOrderDirection,
        reachedEndForQuery
      } = useCatalog();

      const openEditor = (e, song) => {
        e.stopPropagation();
        setEditing(true);
        setSong(song);
        setEditedSong(song);
        console.log(song);
      }

      useEffect(() => {
        let edited = true;
        
        setEdited(edited);
      }, [editedSong, song])

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

    return (
        <>
        <Sheet
            sx = {{
                p: 2,
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
        <ClickAwayListener onClickAway={() => setEditing(false)}>
        <Sheet
            sx = {{
                minWidth: 200,
                width: '30%',
                maxWidth: 600,
                position: 'absolute',
                top: 0,
                bottom: 0,
                background: palette.background.backdrop,
                backdropFilter: 'blur(10px)',
                borderLeft: `1px solid ${palette.divider}`,
                zIndex: 1,
                left: 'auto',
                right: editing ? 0 : -600,
                transition: 'right 0.5s ease-in-out',
            }}
        >
            <AspectRatio ratio={3}>
                <img src="img/wxyc_dark.jpg" alt="Cassette" />
            </AspectRatio>
            <Box
              sx = {{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                transform: 'translateY(-50%)',
                height: 75
              }}
            >
                <Box
                  sx = {{
                    backgroundColor: palette.primary[500],
                    height: 150,
                    width: 150,
                    borderRadius: '50%',
                    '& .MuiInput-root, .MuiSelect-root': {
                      backgroundColor: 'transparent',
                      border: 'none !important',
                      '& input': {
                        textAlign: 'center',
                      },
                      '&.Joy-focused': {
                        backgroundColor: palette.background.surface
                      }
                    }
                  }}
                >
                  <Stack direction={'row'} sx = {{ width: '100%', height: '100%' }} justifyContent={'center'} alignItems={'center'}>
                    <Select defaultValue={editedSong?.genre} size="sm" indicator={null} onChange={(e, newValue) => setEditedSong((prev) => ({...prev, artist: { ...prev.artist, genre: newValue }}))} >
                      <Option value="Rock">RO</Option>
                      <Option value="HipHop">HI</Option>
                    </Select>
                    <Stack direction="column" justifyContent={'center'} alignItems={'center'}>
                      <Input size="sm" sx = {{ width: 50 }} value={editedSong?.artist?.numbercode} onChange={(e, newValue) => setEditedSong((prev) => ({...prev, artist: { ...prev.artist, numbercode: newValue }}))} />
                      <Box
                        sx = {{
                          backgroundColor: palette.neutral[700],
                          height: 75,
                          width: 75,
                          borderRadius: '50%',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Input value={editedSong?.artist?.lettercode} onChange={(e, newValue) => setEditedSong((prev) => ({...prev, artist: { ...prev.artist, lettercode: newValue }}))} 
                          sx = {{
                            height: '90%',
                            width: '90%',
                            borderRadius: '50%',
                          }}
                        />
                      </Box>
                      <Input size="sm" sx = {{ width: 50 }} value={editedSong?.release_number} onChange={(e, newValue) => setEditedSong((prev) => ({...prev, release_number: newValue }))} />
                    </Stack>
                    <Select value={editedSong?.genre} size="sm" indicator={null}>
                      <Option value="Rock">RO</Option>
                    </Select>
                  </Stack>
                </Box>
            </Box>
            <Box
                sx = {{
                    p: 2,
                }}
            >
              <Stack direction="column" spacing={2}>
                <FormControl size="sm">
                  <FormLabel>Title</FormLabel>
                  <Input
                      value={editedSong?.title}
                      onChange={(e, newValue) => {
                        setEditedSong((prev) => ({...prev, title: newValue }));
                      }}
                  />
                </FormControl>
                <FormControl size="sm">
                  <FormLabel>Artist</FormLabel>
                  <Input
                      defaultValue={song?.artist?.name ?? ''}
                      endDecorator={
                        editList.artist ? (<Button 
                          variant="solid" 
                          color="primary"
                          onClick={() => {
                            setEditList((prev) => ({ ...prev, artist: false }));
                          }}
                        >
                          Save
                        </Button>) : null
                      }
                      onChange={(e) => {
                        setEditList((prev) => ({ ...prev, artist: song?.artist?.name !== e.target.value }));
                      }}
                  />
                </FormControl>
                {edited && (<Button>Save</Button>)}
              </Stack>
            </Box>
        </Sheet>
        </ClickAwayListener>
            <SearchBar
                color="success"
                searchString={searchString}
                setSearchString={setSearchString}
                setSearchIn={setSearchIn}
                setGenre={setGenre}
            />
            <Box
               sx = {{
                maxHeight: 'calc(100vh - 350px)',
                overflowY: 'auto',
               }}
            >
            <Table
            aria-labelledby="tableTitle"
            stickyHeader
            hoverRow
            sx={{
              '--TableCell-headBackground': palette.background.level1,
              '--Table-headerUnderlineThickness': '1px',
              '--TableRow-hoverBackground': palette.background.level1,                  
              '& tr > *:last-child': {
                position: 'sticky',
                right: 0,
                bgcolor: 'var(--TableCell-headBackground)',
              },
            }}
          >
            <tbody>
              {loading ? (
                <tr style={{ background: 'transparent'}}>
                  <td colSpan={6} style={{ textAlign: 'center', paddingTop: '3rem', background: 'transparent' }}>
                    <CircularProgress color="primary" size="md" />
                  </td>
                </tr>
              ) : (releaseList.map((row) => (
                <tr key={row.id}
                    onClick={(e) => openEditor(e, row)}
                    style={{
                        cursor: 'pointer'
                    }}
                >
                  <td>
                  <ArtistAvatar
                        entry={row.release_number}
                        artist = {row.artist}
                        format={row.format}
                      />
                  </td>
                  <td>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
                    <Typography level="body4">
                        {row.artist.genre}
                    </Typography>
                    <Typography level="body2">
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
                        }[row.format.includes('vinyl') ? 'vinyl' : 'cd']
                      }
                    >
                      {row.format}
                    </Chip>
                  </td>
                  <td>0</td>
                </tr>
              )))}
                {(!loading && !reachedEndForQuery) && (<tr>
                  <td colSpan={6} style={{ textAlign: 'center' }}>
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
          </Box>
        </Sheet>
        </>
    )
};