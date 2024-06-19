export interface FlowsheetAlbum {
  release: number;
  title: string;
  artist: FlowsheetArtist;
  alternate_artist?: FlowsheetArtist;
  label?: string;
}

export interface FlowsheetArtist {
  name: string;
}
