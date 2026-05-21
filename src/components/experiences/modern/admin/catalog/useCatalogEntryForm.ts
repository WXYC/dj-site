"use client";

import {
  parseRequiredPositiveInt,
} from "@/lib/features/catalog/adminCreateArtistValidation";
import type { ArtistAutocompleteOption } from "./catalogEntryArtistOptions";
import {
  defaultLettersFromName,
  toExistingOption,
} from "./catalogEntryArtistOptions";
import { useMemo, useState } from "react";

export type CatalogEntryArtistMode = "idle" | "existing" | "new" | "created";

export function useCatalogEntryForm() {
  const [genreId, setGenreId] = useState("");
  const [formatId, setFormatId] = useState("");

  const [artistMode, setArtistMode] = useState<CatalogEntryArtistMode>("idle");
  const [artistId, setArtistId] = useState<number | null>(null);
  const [artistInputValue, setArtistInputValue] = useState("");
  const [artistOption, setArtistOption] =
    useState<ArtistAutocompleteOption | null>(null);

  const [codeLetters, setCodeLetters] = useState("");
  const [codeNumber, setCodeNumber] = useState("");
  const [alphabeticalName, setAlphabeticalName] = useState("");

  const [albumTitle, setAlbumTitle] = useState("");
  const [label, setLabel] = useState("");
  const [alternateArtist, setAlternateArtist] = useState("");
  const [discQuantity, setDiscQuantity] = useState("1");
  const [previewAlbumId, setPreviewAlbumId] = useState<number | null>(null);

  const resetArtist = () => {
    setArtistMode("idle");
    setArtistId(null);
    setArtistInputValue("");
    setArtistOption(null);
    setCodeLetters("");
    setCodeNumber("");
    setAlphabeticalName("");
    setPreviewAlbumId(null);
  };

  const onGenreChange = (next: string) => {
    setGenreId(next);
    resetArtist();
  };

  const selectExistingArtist = (artist: {
    id: number;
    artist_name: string;
    code_letters: string;
    code_number: number;
  }) => {
    const option = toExistingOption(artist);
    setArtistOption(option);
    setArtistInputValue(artist.artist_name);
    setArtistMode("existing");
    setArtistId(artist.id);
    setCodeLetters(artist.code_letters);
    setCodeNumber(String(artist.code_number));
    setAlphabeticalName("");
  };

  const selectNewArtist = (name: string) => {
    setArtistMode("new");
    setArtistId(null);
    setArtistOption({ type: "create", inputValue: name });
    setArtistInputValue(name);
    setCodeLetters(defaultLettersFromName(name));
    setCodeNumber("");
    setAlphabeticalName("");
  };

  const markArtistCreated = (id: number) => {
    setArtistId(id);
    setArtistMode("created");
  };

  const genreIdNum = parseRequiredPositiveInt(genreId);
  const formatIdNum = parseRequiredPositiveInt(formatId);

  const albumSectionUnlocked =
    artistMode === "existing" || artistMode === "created";

  const showNewArtistFields = artistMode === "new";

  const codeFieldsLocked = artistMode === "existing" || artistMode === "created";

  const newArtistName = useMemo(() => {
    if (artistMode === "new" || artistMode === "created") {
      return artistOption?.type === "create"
        ? artistOption.inputValue.trim()
        : artistInputValue.trim();
    }
    return "";
  }, [artistMode, artistOption, artistInputValue]);

  const canCreateArtist = useMemo(() => {
    if (artistMode !== "new") return false;
    return (
      genreIdNum !== null &&
      codeLetters.trim().length > 0 &&
      parseRequiredPositiveInt(codeNumber) !== null &&
      newArtistName.length > 0
    );
  }, [artistMode, genreIdNum, codeLetters, codeNumber, newArtistName]);

  const canAddAlbum = useMemo(() => {
    if (!albumSectionUnlocked || artistId === null) return false;
    const title = albumTitle.trim();
    const lab = label.trim();
    return title.length > 0 && lab.length > 0 && formatIdNum !== null;
  }, [
    albumSectionUnlocked,
    artistId,
    albumTitle,
    label,
    formatIdNum,
  ]);

  return {
    genreId,
    setGenreId: onGenreChange,
    formatId,
    setFormatId,
    artistMode,
    artistId,
    artistInputValue,
    setArtistInputValue,
    artistOption,
    setArtistOption,
    codeLetters,
    setCodeLetters,
    codeNumber,
    setCodeNumber,
    alphabeticalName,
    setAlphabeticalName,
    albumTitle,
    setAlbumTitle,
    label,
    setLabel,
    alternateArtist,
    setAlternateArtist,
    discQuantity,
    setDiscQuantity,
    previewAlbumId,
    setPreviewAlbumId,
    genreIdNum,
    formatIdNum,
    albumSectionUnlocked,
    showNewArtistFields,
    codeFieldsLocked,
    newArtistName,
    canCreateArtist,
    canAddAlbum,
    selectExistingArtist,
    selectNewArtist,
    markArtistCreated,
    resetArtist,
  };
}
