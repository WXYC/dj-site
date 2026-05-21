"use client";

import { Format, Genre } from "@/lib/features/catalog/types";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import {
  Checkbox,
  ColorPaletteProp,
  FormControl,
  FormLabel,
  Option,
  Select,
} from "@mui/joy";

const GENRE_OPTIONS: (Genre | "All")[] = [
  "All",
  "Rock",
  "Hiphop",
  "Electronic",
  "Jazz",
  "Classical",
  "Reggae",
  "Soundtracks",
];

const FORMAT_OPTIONS: (Format | "All")[] = ["All", "CD", "Vinyl"];

export const Filters = ({
  color,
}: {
  color: ColorPaletteProp | undefined;
}) => {
  const { filters, setFilter } = useCatalogQuerySearch();

  return (
    <>
      <FormControl size="sm" sx={{ flex: 1 }}>
        <FormLabel>Genre</FormLabel>
        <Select
          color={color || "neutral"}
          value={filters.genre}
          slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
          onChange={(_, newValue) =>
            setFilter({ genre: (newValue as Genre | "All") ?? "All" })
          }
        >
          {GENRE_OPTIONS.map((g) => (
            <Option key={g} value={g}>
              {g}
            </Option>
          ))}
        </Select>
      </FormControl>
      <FormControl size="sm" sx={{ flex: 1 }}>
        <FormLabel>Format</FormLabel>
        <Select
          color={color || "neutral"}
          value={filters.format}
          slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
          onChange={(_, newValue) =>
            setFilter({ format: (newValue as Format | "All") ?? "All" })
          }
        >
          {FORMAT_OPTIONS.map((f) => (
            <Option key={f} value={f}>
              {f}
            </Option>
          ))}
        </Select>
      </FormControl>
      <FormControl size="sm" sx={{ flex: "none", justifyContent: "flex-end" }}>
        <Checkbox
          label="Exclusives Only"
          checked={filters.onStreaming === false}
          onChange={(e) =>
            setFilter({ onStreaming: e.target.checked ? false : undefined })
          }
          sx={{
            "& .MuiCheckbox-checkbox": {
              "&.Mui-checked": {
                backgroundColor: "#7B2D8E",
                borderColor: "#7B2D8E",
              },
              "&.Mui-checked:hover": {
                backgroundColor: "#6a2479",
                borderColor: "#6a2479",
              },
            },
          }}
        />
      </FormControl>
    </>
  );
};
