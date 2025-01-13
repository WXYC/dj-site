import { User } from "../authentication";

export interface AdminState {
    loading: boolean;
    //autocompletedArtists: ProposedArtist[];
    error: string | undefined;
    djs: User[];
};