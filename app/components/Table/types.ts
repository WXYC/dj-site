export type SearchInOption = "All" | "Albums" | "Artists";
export type OrderByOption = "Artist" | "Title" | "Code" | "Format" | "Plays";
export type OrderDirectionOption = "asc" | "desc";

export interface TableHeaderProps {
    textValue: OrderByOption;
    orderBy: OrderByOption;
    orderDirection: OrderDirectionOption;
    handleRequestSort: (property: OrderByOption) => void;
};