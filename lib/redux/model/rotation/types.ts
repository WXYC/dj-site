import { CatalogResult } from "../catalog";

export interface RotationState {
    loading: boolean;
    entries: RotationEntry[];
}

export interface RotationEntry {
    level: Rotation;
    entry: CatalogResult;
}

export type Rotation = "H" | "M" | "L" | "S";