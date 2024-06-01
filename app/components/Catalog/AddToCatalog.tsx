'use client';
import { CatalogEntryProps, ROTATIONS, applicationSlice, catalogSlice, getter, rotationSlice, useDispatch } from "@/lib/redux";
import { Album, ArrowBack, Category, ContentPasteSearch, DiscFull, DynamicForm, FindReplace, InterpreterMode, Repeat, Save } from "@mui/icons-material";
import { Autocomplete, Box, Button, ButtonGroup, CircularProgress, IconButton, Input, Sheet, Stack, Switch, Tooltip, Typography } from "@mui/joy";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";


const AddToCatalog = () => {

  const dispatch = useDispatch();
  
  const searchRef = useRef<HTMLInputElement | null>();

  const [entry, setEntry] = useState<CatalogEntryProps>({});

  useEffect(() => {
    dispatch(rotationSlice.actions.setEditedSong(entry));
  }, [entry]);

  const [FORMATS, setFORMATS ] = useState<string[]>([]);
  const [formatsLoading, setFormatsLoading] = useState<boolean>(true);
  const [GENRES, setGENRES] = useState<string[]>([]);
  const [genresLoading, setGenresLoading] = useState<boolean>(true);

  useEffect(() => {

    (async () => {
      const { data, error } = await getter("library/formats")();

      setFormatsLoading(false);

      if (error)
      {
        toast.error(error?.message);
      }

      setFORMATS(data.map((format: any) => format.format_name));
    })();

    (async () => {
      const { data, error } = await getter("library/genres")();

      setGenresLoading(false);

      if (error)
      {
        toast.error(error?.message);
      }

      setGENRES(data.map((genre: any) => genre.genre_name));
    })();

  }, []);

  return (
    <Box>
      <Stack direction="row" spacing={2} sx = {{ alignItems: 'center' }}>
      <IconButton
        variant="plain"
        color="neutral"
        onClick={() => {
          dispatch(rotationSlice.actions.setEditedSong(null));
          dispatch(applicationSlice.actions.closeSideBar());
        }}
      >
        <ArrowBack />
      </IconButton>
      <Typography level="body-lg">Add to Catalog</Typography>
      </Stack>
      <Stack direction="column" spacing={2} sx = {{ pt: 3 }}>
        <Input
          startDecorator={<Album />}
          value={entry.album?.title}
          onChange={(event) => setEntry({ ...entry, album: { ...entry.album, title: event.target.value } })}
          placeholder="Album Title"
          sx = {{ maxWidth: 293 }}
          endDecorator={entry.album?.title && <Tooltip variant="outlined" title="Check Existing Catalog for this Title" placement="top">
            <IconButton
              size="sm"
              onClick={() => dispatch(catalogSlice.actions.setQuery(entry.album?.title))}
            >
              <ContentPasteSearch />
            </IconButton>
          </Tooltip>}
        />
        <Sheet variant="outlined"
          sx = {{
            padding: 2,
            pb: 3.5,
            borderRadius: 'md',
          }}
        >
          <Stack direction="column" spacing={1}>
            <Stack direction="row" sx = {{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography level="body-md">Artist Information</Typography>
              <Tooltip variant="outlined" title="Autofill Information from Catalog" placement="top">
              <Switch defaultChecked startDecorator={<FindReplace fontSize="small" />} />
              </Tooltip>
            </Stack>
          <Autocomplete
            freeSolo={true}
            startDecorator={<InterpreterMode />}
            placeholder="Name"
            options={[]}
            sx={{ width: 250 }}
            endDecorator={<CircularProgress size="sm" />}
            onChange={(event, newValue) => {
              setEntry({ ...entry, album: { ...entry.album, artist: { name: newValue ?? undefined } } });
            }}
          />
          <Autocomplete
            freeSolo={true}
            startDecorator={<Category fontSize="small" />}
            placeholder="Genre"
            options={GENRES}
            sx={{ width: 250 }}
            endDecorator={genresLoading && <CircularProgress size="sm" />}
            onChange={(event, newValue) => {
              setEntry({ ...entry, album: { ...entry.album, artist: { ...entry.album?.artist, genre: newValue ?? undefined } } });
            }}
          />
      <Box
        ref={searchRef}
        component="div"
        sx = {{
          display: 'flex',
          justifyContent: 'space-between',
          flexDirection: 'row',
          background: 'var(--joy-palette-background-surface)',
          outline: '1px solid',
          outlineColor: 'var(--joy-palette-neutral-outlinedBorder, var(--joy-palette-neutral-200, #D8D8DF))',
          borderRadius: 'sm',
          maxWidth: '250px',
          minHeight: 'var(--Input-minHeight)',
          cursor: 'text',
          '& input': {
            background: 'transparent !important',
            outline: 'none !important',
            border: 'none',
            fontFamily: 'inherit !important',
            minWidth: '0 !important',
            px: 0,
            flex: 1,
            minHeight: '2rem',
            cursor: 'text',
          },
          '&:hover': {
            outlineColor: 'var(--joy-palette-neutral-outlinedBorder, var(--joy-palette-neutral-200, #D8D8DF))',
          },
          '&:focus-within': {
            outline: '2px solid',
            outlineColor: 'var(--joy-palette-primary-400, #02367D)',
          },
        }}
        // onclick and onfocus
      >
        <Box
          sx = {{
            ml: 1.2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'min(1.5rem, var(--Input-minHeight))',
            pointerEvents: 'none',
            '& svg': {
              fill: 'var(--joy-palette-neutral-400) !important',
              pointerEvents: 'none',
            },
          }}
        >
          <DynamicForm />
        </Box>
        <input
          style = {{ maxWidth: '70px', borderRight: '1px solid var(--joy-palette-neutral-outlinedBorder)' }}
          placeholder="Initials"
          onClick={(e) => e.stopPropagation()}
          value={entry.album?.artist?.lettercode}
          onChange={(event) => setEntry({ ...entry, album: { ...entry.album, artist: { ...entry.album?.artist, lettercode: event.target.value } } })}
        />
        <input
          style = {{ maxWidth: '50px', borderRight: '1px solid var(--joy-palette-neutral-outlinedBorder)' }}
          placeholder="##"
          onClick={(e) => e.stopPropagation()}
          value={entry.album?.artist?.numbercode}
          onChange={(event) => {
            var newNumber: number | undefined = parseInt(event.target.value);
            if (isNaN(newNumber)) {
              newNumber = undefined;
              event.target.value = '';
            }
            setEntry({ ...entry, album: { ...entry.album, artist: { ...entry.album?.artist, numbercode: newNumber }} });
          }}
        />
        <input
          style = {{ maxWidth: '50px'}}
          placeholder="##"
          onClick={(e) => e.stopPropagation()}
          value={entry.album?.release}
          onChange={(event) => {
            var newNumber: number | undefined = parseInt(event.target.value);
            if (isNaN(newNumber)) {
              newNumber = undefined;
              event.target.value = '';
            }
            setEntry({ ...entry, album: { ...entry.album, release: newNumber }});
          }}
        />
        <Box
        component="div"
          className="MuiInput-endDecorator css-x3cgwv-JoyInput-endDecorator"
          sx = {{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: -0.5,
          }}
          >
          </Box>
      </Box>
          </Stack>
        </Sheet>
        <Sheet variant="outlined"
          sx = {{
            padding: 2,
            borderRadius: 'md',
          }}
        >
          <Stack direction="column" spacing={1}>
        <Stack direction="row" spacing={2} sx = {{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography level="body-md"
            startDecorator={<DiscFull />}
          >Format</Typography>
          <ButtonGroup>
            <Autocomplete
              freeSolo={true}
              placeholder="Format"
              options={FORMATS}
              sx={{ width: 138 }}
              endDecorator={formatsLoading && <CircularProgress size="sm" />}
              onChange={(event, newValue) => {
                setEntry({ ...entry, album: { ...entry.album, format: newValue?.toString() } });
              }}
            />
            </ButtonGroup>
          </Stack>
        <Stack direction="row" spacing={2} sx = {{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography level="body-md"
            startDecorator={<Repeat />}
          >Rotation</Typography>
          <ButtonGroup>
          {(ROTATIONS.map((rotation) => (
                            <Button
                                key={`rotation-${rotation}-editedSong-btn`}
                                variant={'outlined'}
                                color={'neutral'}
                                size="sm"
                                onClick={() => {
                                  // DO SOMETHING
                                }}
                            >
                                {rotation}
                            </Button>
                        )))}
            </ButtonGroup>
          </Stack>
          </Stack>
        </Sheet>
        <Button
          color="success"
          startDecorator={<Save />}
        >
          Save
        </Button>
      </Stack>
    </Box>
  );
};

export default AddToCatalog;