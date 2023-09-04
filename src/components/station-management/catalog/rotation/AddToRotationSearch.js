import React, { useState, useEffect, useRef } from "react";
import { Box, Button, Chip, Divider, FormControl, Option, Select, Sheet, Stack, Typography } from "@mui/joy";

import TroubleshootIcon from "@mui/icons-material/Troubleshoot";
import { getFormatsFromBackend } from "../../../../services/station-management/rotation-service";
import { ClickAwayListener } from "@mui/material";

export const AddToRotationSearch = () => {

    const searchRef = useRef(null);
    const [song, setSong] = useState("");
    const [artist, setArtist] = useState("");
    const [album, setAlbum] = useState("");
    const [label, setLabel] = useState("");
    const [live, setLive] = useState(false);
    
    const [formats, setFormats] = useState([]);

    useEffect(() => {
        (async () => {
            const { data, error } = await getFormatsFromBackend();

            if (error) {
                console.error(error);
            }

            if (data) {
                setFormats(data);
            }
        })();
    }, []);

    const handleSearchFocused = () => {
        console.log("search focused");
    };

    const closeSearch = () => {
        searchRef.current?.blur();
    };


    return (
        <Box
        sx={{
          display: "flex",
          alignItems: "center",
          my: 1,
          gap: 1,
          flexWrap: "wrap",
          "& > *": {
            minWidth: "clamp(0px, (300px - 80%), 80%)",
            flexGrow: 1,
          },
        }}
      >
    <ClickAwayListener
        onClickAway={closeSearch}
      >
        <Box
          ref={searchRef}
          component="div"
          sx = {{
            display: 'flex',
            justifyContent: 'space-between',
            flexDirection: 'row',
            zIndex: 2,
            flex: 1,
            background: 'var(--joy-palette-background-surface)',
            outline: '1px solid',
            outlineColor: 'var(--joy-palette-neutral-outlinedBorder, var(--joy-palette-neutral-200, #D8D8DF))',
            borderRadius: '8px',
            minHeight: 'var(--Input-minHeight)',
            paddingInline: '0.5rem',
            cursor: 'text',
            pr: 0,
            '& input': {
              background: 'transparent !important',
              outline: 'none !important',
              border: 'none !important',
              fontFamily: 'inherit !important',
              minWidth: '0 !important',
              px: 1,
              flex: 1,
              minHeight: '2rem',
              cursor: 'text',
            },
            '&:hover': {
              outlineColor: 'var(--joy-palette-neutral-700)',
            },
            '&:focus-within': {
              outline: '2px solid',
              outlineColor: 'var(--joy-palette-primary-400, #02367D)',
            },
          }}
          onFocus={handleSearchFocused}
        >
          <Box
            sx = {{
              marginInlineEnd: '0.5rem',
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
            <TroubleshootIcon />
          </Box>
          <input
            placeholder="Artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <Divider orientation="vertical" />
          <input
            placeholder="Album"
            value={album}
            onChange={(e) => setAlbum(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <Divider orientation="vertical" />
          <input
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <Divider orientation="vertical" />
          <Select placeholder="Format"
           sx = {{
            border: 'none !important',
            borderRadius: '0 !important',
           }}
          >
            {formats.map((format) => (
                <Option key={`format-${format.id}`} value={format.id}>{format.format_name}</Option>
            ))}
          </Select>
          <Divider orientation="vertical" />
          <Select placeholder="Frequency"
           sx = {{
            border: 'none !important',
            borderTopLeftRadius: '0 !important',
            borderBottomLeftRadius: '0 !important',
           }}
          >
            <Option value="H">Heavy</Option>
            <Option value="M">Medium</Option>
            <Option value="L">Light</Option>
            <Option value="S">Singles</Option>
          </Select>
        </Box>
        </ClickAwayListener>
      <Button
       sx = {{
        flex: '0 0 auto',
       }}
      >
        Add to Rotation
    </Button>
  </Box>
    )
}