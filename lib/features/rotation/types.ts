import { RotationBin } from "@wxyc/shared/dtos";

export { RotationBin };

// Backward-compatible alias for consumers that import { Rotation }
export const Rotation = RotationBin;
export type Rotation = RotationBin;

export type RotationFrontendState = {
  orderBy: "title" | "artist" | "album";
  orderDirection: "asc" | "desc";
};

export type KillRotationParams = {
  rotation_id: number;
  kill_date: Date | undefined;
};

