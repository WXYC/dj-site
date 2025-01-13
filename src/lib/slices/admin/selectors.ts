import { createAppSelector } from "@/lib/hooks";
import { RootState } from "@/lib/store";
import { createSelector } from "@reduxjs/toolkit";
import { getPopups } from "../application/selectors";
import { Authority, PopupStateWithPayload } from "@/lib/models";

export const getAdminLoading = (state: RootState) => state.admin.loading;
export const getAdminError = (state: RootState) => state.admin.error;
export const getDJs = (state: RootState) => state.admin.djs;

//export const getAutocompleteResults = (state: RootState) => state.admin.autocompletedArtists;

export const getDJPromotions = createAppSelector([getDJs, getPopups], (djs, popups) => djs.reduce((acc, dj) => {
    let payload = ((popups[`permissions-${dj.username}`]) as PopupStateWithPayload)?.payload;
    if (payload)
    {
        acc[dj.username] = Number(payload) as Authority;
    }
    else
    {
        acc[dj.username] = dj.authority;
    }
    return acc;
}, {} as { [key: string]: Authority }));