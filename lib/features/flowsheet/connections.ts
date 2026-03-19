import { AlbumEntry } from "../catalog/types";

export const submitFromBin = (
  entry: AlbumEntry,
  title: string,
  isRequest: boolean,
  label?: string
) => {
  return {
    album_id: entry.id,
    track_title: title,
    request_flag: isRequest,
    record_label: label,
  };
};

export const submitFromCatalog = (
  entry: AlbumEntry,
  title: string,
  isRequest: boolean,
  label?: string
) => submitFromBin(entry, title, isRequest, label);
