import type { Label } from "@wxyc/shared/dtos";

export type { Label };

/** GET /labels/search — `q` is matched case-insensitively as a prefix. */
export type SearchLabelsParams = {
  q: string;
  limit?: number;
};
