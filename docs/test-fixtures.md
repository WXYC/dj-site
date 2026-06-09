# Example Music Data for Tests

WXYC is a freeform station. When creating test fixtures or mock data, use representative artists instead of mainstream acts like Queen, Radiohead, or The Beatles. The canonical data source is `wxyc-shared/src/test-utils/wxyc-example-data.json`. See the reference table in the org-level CLAUDE.md.

## Recommended Defaults for Factory Functions

When overriding factory function defaults or creating new test data, prefer these WXYC-representative values:

```typescript
// Instead of generic "Test Artist" / "Test Album" defaults, use real WXYC catalog data:

createTestArtist({ name: "Juana Molina", lettercode: "RO", numbercode: 42, genre: "Rock" })
createTestArtist({ name: "Stereolab", lettercode: "RO", numbercode: 87, genre: "Rock" })
createTestArtist({ name: "Cat Power", lettercode: "RO", numbercode: 23, genre: "Rock" })
createTestArtist({ name: "Jessica Pratt", lettercode: "RO", numbercode: 112, genre: "Rock" })
createTestArtist({ name: "Chuquimamani-Condori", lettercode: "EL", numbercode: 15, genre: "Electronic" })
createTestArtist({ name: "Duke Ellington & John Coltrane", lettercode: "JA", numbercode: 7, genre: "Jazz" })

createTestAlbum({
  title: "DOGA",
  artist: createTestArtist({ name: "Juana Molina", lettercode: "RO", numbercode: 42 }),
  label: "Sonamos",
  format: "CD",
})

createTestAlbum({
  title: "Moon Pix",
  artist: createTestArtist({ name: "Cat Power", lettercode: "RO", numbercode: 23 }),
  label: "Matador Records",
  format: "CD",
})

createTestAlbum({
  title: "On Your Own Love Again",
  artist: createTestArtist({ name: "Jessica Pratt", lettercode: "RO", numbercode: 112 }),
  label: "Drag City",
  format: "Vinyl LP",
})

createTestFlowsheetEntry({
  artist_name: "Juana Molina",
  album_title: "DOGA",
  track_title: "la paradoja",
  record_label: "Sonamos",
})

createTestFlowsheetEntry({
  artist_name: "Duke Ellington & John Coltrane",
  album_title: "Duke Ellington & John Coltrane",
  track_title: "In a Sentimental Mood",
  record_label: "Impulse Records",
  request_flag: true,
})

createTestFlowsheetQuery({
  artist: "Chuquimamani-Condori",
  album: "Edits",
  song: "Call Your Name",
  label: "self-released",
})

createTestAlbumQueryResponse({
  artist_name: "Stereolab",
  album_title: "Aluminum Tunes",
  code_letters: "RO",
  code_artist_number: 87,
  genre_name: "Rock",
  label: "Duophonic",
})
```
