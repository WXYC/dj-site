
export interface AdminState {
    loading: boolean;
    error: string | null;
    djs: DJ[];
};

export interface DJ {
    userName: string;
    realName: string;
    djName: string;
    isAdmin: boolean;
    shows?: string;
}