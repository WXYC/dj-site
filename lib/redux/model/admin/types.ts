
export interface AdminState {
    loading: boolean;
    error: string | undefined;
    djs: DJ[];
};

export interface DJ {
    userName: string;
    realName: string;
    djName: string;
    isAdmin: boolean;
    shows?: string;
    email?: string;
}