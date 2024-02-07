
export interface AdminState {
    loading: boolean;
    djs: DJ[];
};

export interface DJ {
    id: number;
    real_name: string;
    dj_name: string;
}