import { FlowSheetEntry, Rotation } from "@/lib/redux";
import { FSEntry } from "./backend-types";

export const convertFlowsheetResult = (index: number, result: FSEntry) : FlowSheetEntry => {
    return {
        id: index,
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