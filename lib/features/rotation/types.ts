import type { RotationBin } from "@wxyc/shared";

export type RotationFrontendState = {
  orderBy: "title" | "artist" | "album";
  orderDirection: "asc" | "desc";
};

export type RotationParams = {
  album_id: string;
  rotation_bin: RotationBin;
};

export type KillRotationParams = {
  rotation_id: number;
  kill_date: Date | undefined;
};

// Re-export for backwards compatibility during migration
export type { RotationBin as Rotation } from "@wxyc/shared";

