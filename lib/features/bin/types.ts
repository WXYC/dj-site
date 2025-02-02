export type DJBinQuery = {
  dj_id: number;
};

export type BinQueryResponse = {
  album_id: number;
  album_title: string;
  artist_name: string;
  code_artist_number: number;
  code_letters: string;
  code_number: number;
  format_name: string;
  genre_name: string;
  label: string | undefined;
};
