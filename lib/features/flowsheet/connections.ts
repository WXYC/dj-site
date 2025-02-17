import { AlbumEntry } from "../catalog/types";
import { FlowsheetSubmissionParams } from "./types";

export const submitFromBin = (
  entry: AlbumEntry,
  title: string,
  isRequest: boolean,
  label?: string
): FlowsheetSubmissionParams => {
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
): FlowsheetSubmissionParams => submitFromBin(entry, title, isRequest, label);
