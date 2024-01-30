// APP STATE
export interface ApplicationState {
    enableClassicView: boolean;
    classicView: boolean;
    popupContent?: JSX.Element;
    popupOpen: boolean;
};

// GLOBAL CONCEPTS
export interface Song {
    title: string;
    album?: Album;
};

export interface Album {
    id: number;
    title: string;
    artist?: Artist;
};

export interface Artist {
    name: string;
    genre: Genre;
};

export interface Genre {
    name: "Rock" | "Hip Hop" | "Electronic" | "Jazz" | "Folk" | "Other"; // NOT DONE
};