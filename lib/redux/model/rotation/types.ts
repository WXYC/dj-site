import { CatalogResult } from "../catalog";

export interface RotationState {
    loading: boolean;
    entries: RotationEntry[];
}

export interface RotationEntry extends CatalogResult {
    level: Rotation;
}

export type Rotation = "H" | "M" | "L" | "S";