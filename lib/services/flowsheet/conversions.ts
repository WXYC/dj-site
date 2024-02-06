import { FlowSheetEntry } from "@/lib/redux";
import { convertRotationId } from "../catalog/conversions";
import { FSEntry } from "./backend-types";

export const convertFlowsheetResult = (index: number, result: FSEntry) : FlowSheetEntry => {
    return {
        id: index,
        message: result.message ?? undefined,
        song: result.track_title ? {
            title: result.track_title ?? '',
            album: {
                title: result.album_title ?? '',
                artist: {
                    name: result.artist_name ?? '',
                }
            }
        } : undefined,
        request: result.request_flag,
        rotation_freq: convertRotationId(result.rotation_id ?? undefined)
    }
}