import { CatalogResult, FlowSheetEntry, FlowSheetEntryProps, Rotation } from "@/lib/redux";
import { CatalogFSEntry, FSEntry, PersonalFSEntry, SpecificEntry } from "./backend-types";

export const convertFlowsheetResult = (result: FSEntry) : FlowSheetEntry => {
    return {
        id: result.id,
        message: result.message ?? undefined,
        song: result.track_title ? {
            title: result.track_title ?? '',
            album: {
                release: result.album_id ?? -1,
                title: result.album_title ?? '',
                artist: {
                    name: result.artist_name ?? '',
                },
                label: result.record_label ?? '',
            }
        } : undefined,
        request: result.request_flag,
        rotation_freq: result.rotation_play_freq as Rotation ?? undefined,
    }
}

export const convertCatalogToFlowsheet = (input: CatalogResult): FlowSheetEntryProps => {
    return {
        message: "",
        song: {
            title: "",
            album: input.album,
        },
        request: false,
        catalog_id: input.id,
        rotation_freq: input.album.rotation
    };
}

export const convertGeneralToSpecificEntry = (entry: FlowSheetEntryProps): SpecificEntry =>
    entry.catalog_id ? {
        message: entry.message,
        request_flag: entry.request,
        track_title: entry.song?.title,
        album_id: entry.catalog_id,
        rotation_id: undefined
    } as CatalogFSEntry : {
        message: entry.message,
        request_flag: entry.request,
        track_title: entry.song?.title,
        album_title: entry.song?.album?.title,
        artist_name: entry.song?.album?.artist?.name
    } as PersonalFSEntry;