export type RotationFrontendState = {
  orderBy: "title" | "artist" | "album";
  orderDirection: "asc" | "desc";
};


export type RotationParams = {
  album_id: string;
  play_freq: Rotation;
};

export type KillRotationParams = {
  rotation_id: number;
  kill_date: Date | undefined;
};

export enum Rotation {
  S = "S",
  L = "L",
  M = "M",
  H = "H",
}

