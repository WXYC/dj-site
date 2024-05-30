import { User } from "../authentication";
import { CatalogResult } from "../catalog";

export interface BinState {
    loading: boolean;
    bin: CatalogResult[];
}

export type BinQueryParameters = {
    dj: User;
    entry: CatalogResult;
}

export type BinMultiQueryParameters = {
    dj: User;
    entry: CatalogResult[];
}