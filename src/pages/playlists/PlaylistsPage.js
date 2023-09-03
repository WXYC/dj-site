import { Box, CircularProgress, Grid, Option, Select, Sheet, Stack, Typography } from "@mui/joy"
import React, { useEffect, useState } from "react"
import PlaylistCard from "../../components/playlists/PlaylistCard"
import { getPlaylistsFromBackend } from "../../services/playlists/playlists-service";
import { toast } from "sonner";

const examplePlaylists = [
  {
      name: "Playlist 1",
      previewArtists: ["Royal Blood", "Muse", "Florence + The Machine", "King Crimson"],
      previewAlbums: ["How Did We Get So Dark?", "The 2nd Law", "Lungs", "In The Court of the Crimson King"],
      date: "2021-10-01",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 2",
      previewArtists: ["Arctic Monkeys", "The Strokes", "Queens of the Stone Age", "The Black Keys"],
      previewAlbums: ["AM", "Is This It", "Songs for the Deaf", "El Camino"],
      date: "2021-11-15",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 3",
      previewArtists: ["Radiohead", "Arcade Fire", "Alt-J", "Vampire Weekend"],
      previewAlbums: ["OK Computer", "Funeral", "An Awesome Wave", "Modern Vampires of the City"],
      date: "2022-02-28",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 4",
      previewArtists: ["Tame Impala", "Foals", "Glass Animals", "Cage the Elephant"],
      previewAlbums: ["Currents", "Total Life Forever", "Dreamland", "Melophobia"],
      date: "2022-06-10",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 5",
      previewArtists: ["Daft Punk", "Justice", "LCD Soundsystem", "The Chemical Brothers"],
      previewAlbums: ["Random Access Memories", "Cross", "Sound of Silver", "Surrender"],
      date: "2022-09-23",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 6",
      previewArtists: ["Coldplay", "Imagine Dragons", "The Killers", "U2"],
      previewAlbums: ["A Rush of Blood to the Head", "Night Visions", "Hot Fuss", "The Joshua Tree"],
      date: "2023-01-07",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 7",
      previewArtists: ["Foo Fighters", "Pearl Jam", "Red Hot Chili Peppers", "Nirvana"],
      previewAlbums: ["The Colour and the Shape", "Ten", "Californication", "Nevermind"],
      date: "2023-03-15",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 8",
      previewArtists: ["Beyoncé", "Rihanna", "Adele", "Taylor Swift"],
      previewAlbums: ["Lemonade", "Anti", "21", "1989"],
      date: "2023-05-22",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 9",
      previewArtists: ["Ed Sheeran", "Sam Smith", "Bruno Mars", "Justin Bieber"],
      previewAlbums: ["÷", "In the Lonely Hour", "24K Magic", "Purpose"],
      date: "2023-08-10",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 10",
      previewArtists: ["Drake", "Kendrick Lamar", "J. Cole", "Travis Scott"],
      previewAlbums: ["Take Care", "good kid, m.A.A.d city", "2014 Forest Hills Drive", "Astroworld"],
      date: "2023-10-28",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 11",
      previewArtists: ["The Weeknd", "Post Malone", "Billie Eilish", "Dua Lipa"],
      previewAlbums: ["After Hours", "Hollywood's Bleeding", "When We All Fall Asleep, Where Do We Go?", "Future Nostalgia"],
      date: "2023-12-01",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 12",
      previewArtists: ["Maroon 5", "OneRepublic", "Coldplay", "Imagine Dragons"],
      previewAlbums: ["Songs About Jane", "Native", "Parachutes", "Night Visions"],
      date: "2024-02-15",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 13",
      previewArtists: ["Kanye West", "Jay-Z", "Eminem", "Lil Wayne"],
      previewAlbums: ["My Beautiful Dark Twisted Fantasy", "The Blueprint", "The Marshall Mathers LP", "Tha Carter III"],
      date: "2024-04-28",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 14",
      previewArtists: ["Sia", "Ariana Grande", "Katy Perry", "Rihanna"],
      previewAlbums: ["1000 Forms of Fear", "Dangerous Woman", "Teenage Dream", "Loud"],
      date: "2024-07-10",
      djs: ["Turncoat"]
  },
  {
      name: "Playlist 15",
      previewArtists: ["Metallica", "Iron Maiden", "Black Sabbath", "Megadeth"],
      previewAlbums: ["Master of Puppets", "The Number of the Beast", "Paranoid", "Rust in Peace"],
      date: "2024-09-23",
      djs: ["Turncoat"]
  }
];

/**
 * The page that displays all playlists for a given user. Contains sorting and filtering options.
 * 
 * @page
 * @category Playlists
 * 
 * @returns {JSX.Element} The fully rendered PlaylistsPage component.
 */
const PlaylistsPage = () => {

    const [sort, setSort] = useState("date");
    const [ascdesc, setAscdesc] = useState(false); // false = descending, true = ascending
    const [playlists, setPlaylists] = useState([]);

    useEffect(() => {
        (async () => {
          const { data, error } = await getPlaylistsFromBackend();

          if (error) {
            toast.error("We could not retrieve your playlists...");
            console.error(error);
          }

          let dj_set = data.map((item, idx) => ({
            id: item.show,
            name: item.show_name.length > 0 ? item.show_name : `Playlist ${idx + 1}`,
            date: item.date,
            previewArtists: item.preview.map((item) => item.artist_name),
            previewAlbums: item.preview.map((item) => item.album_name),
            djs: item.djs,
          }));

          console.log(data);
          setPlaylists(dj_set);
        })();
    }, []);

    const sortPlaylists = (playlistSet, by, asc) => {
      if (playlistSet === undefined || playlistSet?.length === 0 || playlistSet === null) return null;
      if (by === "name") {
        return playlistSet.sort((a, b) => {
          if (asc) {
            return a.name.localeCompare(b.name);
          } else {
            return b.name.localeCompare(a.name);
          }
        });
      } else if (by === "date") {
        return playlistSet.sort((a, b) => {
          if (asc) {
            return a.date.localeCompare(b.date);
          } else {
            return b.date.localeCompare(a.date);
          }
        });
      } else if (by === "random") {
        return playlistSet.sort(() => Math.random() - 0.5);
      } else if (by === "dj") {
        return playlistSet; // TODO: implement
      } else {
        return playlistSet;
      }
    };

    return (
        <>
        <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          my: 1,
          gap: 1,
          flexWrap: 'wrap',
          '& > *': {
            minWidth: 'clamp(0px, (500px - 100%) * 999, 100%)',
            flexGrow: 1,
          },
        }}
      >
        <Typography level="h1">
          Your Playlists
        </Typography>
        <Box sx = {{ flex: 999 }}></Box>
    </Box>
    <Box>
      <Typography level="body3">
        Sort by
      </Typography>
      <Stack direction="row" spacing={1}>
      <Select
        sx = {{
          maxWidth: {
            xs: '100%',
            sm: '300px',
          }
        }}
        size="sm"
        defaultValue={"date"}
        onChange={(e, newValue) => setSort(newValue)}
      >
        <Option value="date">Date</Option>
        <Option value="name">Name</Option>
        <Option value="random">Random</Option>
      </Select>
      <Select
        sx = {{
          maxWidth: {
            xs: '100%',
            sm: '200px',
          }
        }}
        size="sm"
        defaultValue={"desc"}
        onChange={(e, newValue) => setAscdesc(newValue === "asc")}
      >
        <Option value="asc">Ascending</Option>
        <Option value="desc">Descending</Option>
      </Select>
      </Stack>
    </Box>
    <Sheet
    variant="outlined"
      sx={{
        borderRadius: 'lg',
        p: 1,
        maxHeight: 'calc(100vh - 200px)',
        overflow: 'scroll'
      }}
    >
    <Grid container spacing={0}>
        {sortPlaylists(playlists, sort, ascdesc)?.map((playlist) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={3} key={playlist.name}
            >
              <Box
                sx = {{
                  padding: 1, // absolutely vital to the layout
                  margin: 0.5,
                }}
              >
                <PlaylistCard playlist={playlist} />
              </Box>
            </Grid>
        )) ?? <CircularProgress />}
    </Grid>
    </Sheet>
    </>
    )
}

export default PlaylistsPage