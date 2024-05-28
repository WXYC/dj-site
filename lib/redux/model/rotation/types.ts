import { OrderByOption, OrderDirectionOption } from "@/app/components/Table/types";
import { CatalogResult } from "../catalog";

export interface RotationState {
    loading: boolean;
    entries: CatalogResult[];
    orderBy: OrderByOption;
    orderDirection: OrderDirectionOption;
}

export type Rotation = "H" | "M" | "L" | "S";

export const Rotations: Rotation[] = ["H", "M", "L", "S"];