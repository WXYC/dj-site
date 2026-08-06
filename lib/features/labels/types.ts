export type LabelRow = {
  id: number;
  label_name: string;
  parent_label_id?: number | null;
};

/** GET /labels/search — `q` is matched case-insensitively as a prefix. */
export type SearchLabelsParams = {
  q: string;
  limit?: number;
};
