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
    shows?: string;
    email?: string;
}