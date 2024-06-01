import { OrderByOption, OrderDirectionOption } from "@/app/components/Table/types";
import { CatalogEntryProps, CatalogResult } from "../catalog";

export interface RotationState {
    loading: boolean;
    entries: CatalogResult[];
    orderBy: OrderByOption;
    orderDirection: OrderDirectionOption;
    editedSong?: CatalogEntryProps;
}

export type Rotation = "H" | "M" | "L" | "S";

export const ROTATIONS: Rotation[] = ["H", "M", "L", "S"];