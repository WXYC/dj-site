import { AdminType } from "../authentication";
import { ProposedArtist } from "../types";

export interface AdminState {
    loading: boolean;
    adminLoading: boolean;
    musicDirectorLoading: boolean;
    autocompletedArtists: ProposedArtist[];
    error: string | undefined;
    djs: DJ[];
};

export interface DJ {
    userName: string;
    realName: string;
    djName: string;
    adminType: AdminType;
    authType: AdminAuthenticationStatus;
    shows?: string;
    email?: string;
}

export enum AdminAuthenticationStatus {
    Confirmed,
    New,
    Reset
}

export interface AdminProtectedRoutesType {
    [key: string]: string[];
}

export const AdminProtectedRoutes: AdminProtectedRoutesType = {
    [AdminType.StationManager]: ["roster", "catalog"],
    [AdminType.MusicDirector]: ["catalog"],
    [AdminType.None]: []
};