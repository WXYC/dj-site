"use client";

import { Cancel, Search } from "@mui/icons-material";
import {
  Box,
  CircularProgress,
  FormControl,
  FormHelperText,
  IconButton,
  Input,
} from "@mui/joy";

interface PlaylistSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  isLoading: boolean;
}

export default function PlaylistSearchBar({
  query,
  onQueryChange,
  isLoading,
}: PlaylistSearchBarProps) {
  return (
    <Box>
      <FormControl sx={{ width: "100%", maxWidth: 600 }}>
        <Input
          placeholder="Search playlists..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          startDecorator={<Search />}
          endDecorator={
            isLoading ? (
              <CircularProgress size="sm" />
            ) : query ? (
              <IconButton
                variant="plain"
                color="neutral"
                onClick={() => onQueryChange("")}
              >
                <Cancel />
              </IconButton>
            ) : null
          }
          sx={{ fontSize: "md" }}
        />
        <FormHelperText>
          Search by artist, song, album, label, or DJ name. Use AND, OR, NOT for Boolean searches.
          Wrap phrases in quotes for exact matches.
        </FormHelperText>
      </FormControl>
    </Box>
  );
}
