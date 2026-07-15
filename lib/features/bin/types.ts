import type { BinLibraryDetails } from "@wxyc/shared/dtos";

export type { BinLibraryDetails };

export type DJBinQuery = {
  dj_id: string; // User ID from better-auth (string)
};

export type BinMutationQuery = DJBinQuery & {
  album_id: number;
};
