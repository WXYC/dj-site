import React, { useEffect, useCallback } from "react"
import AspectRatio from '@mui/joy/AspectRatio';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import CardOverflow from '@mui/joy/CardOverflow';
import Divider from '@mui/joy/Divider';
import Typography from '@mui/joy/Typography';
import IconButton from '@mui/joy/IconButton';
import Link from '@mui/joy/Link';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { Box, Stack, useTheme } from "@mui/joy";
import { getArtwork } from "../../services/artwork/artwork-service";
import { getNowPlayingFromBackend } from "../../services/flowsheet/flowsheet-service";

let animationController = null;

const BOT_RESPONSES = {
  song: 'Random Selection',
  dj: '🤖 Auto DJ',
}

const NowPlaying = (props) => {

  const [songName, setSongName] = React.useState(BOT_RESPONSES.song);
  const [albumName, setAlbumName] = React.useState('');
  const [artistName, setArtistName] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [djName, setDjName] = React.useState(BOT_RESPONSES.dj);

  const [imageUrl, setImageUrl] = React.useState('img/cassette.png');

  const [playing, setPlaying] = React.useState(false);
  const [embedded, setEmbedded] = React.useState(true);

  const [isSong, setIsSong] = React.useState(false);

  const AUDIO_SOURCE = 'https://audio-mp3.ibiblio.org/wxyc.mp3';

  const analyzer = React.useRef(null);
  const audioRef = React.useRef(null);
  const source = React.useRef(null);

  const canvasRef = React.useRef(null);

  const theme = useTheme();

  const [fadeTimeout, setFadeTimeout] = React.useState(null);

  const destroyAndBuildNewCanvas = () => {
    console.log("destroyAndBuildNewCanvas");
    let container = document.getElementById('canvas-container');
    if (container) {
      container.innerHTML = '';
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = container.clientWidth - 40;
      canvasRef.current.height = container.clientHeight;
      container.appendChild(canvasRef.current);
    }
  }

  const getImage = async (artist, album) => {
    if (album == undefined || artist == undefined) return "";
    let storedArtwork = sessionStorage.getItem(
      `img-${album}-${artist}`
    );
    if (storedArtwork) return storedArtwork;
    try {
      let retrievedArtwork = await getArtwork({
        title: album,
        artist: artist,
      });
      // THE CONVENTION IS ALBUM THEN ARTIST IN THIS APP
      sessionStorage.setItem(
        `img-${album}-${artist}`,
        retrievedArtwork
      );
      return retrievedArtwork;
    } catch (e) {
      sessionStorage.setItem(
        `img-${album}-${artist}`,
        ""
      );
      return "";
    }
  };

  const [getSongTimeout, setGetSongTimeout] = React.useState(null);
  useEffect(() => {
/*     try {
      setEmbedded(window.self !== window.top);
    } catch (e) {
      setEmbedded(true);
    } */
    destroyAndBuildNewCanvas();
    document.addEventListener('resize', destroyAndBuildNewCanvas);

    const getSong = async () => {
      const { data, error } = await getNowPlayingFromBackend();

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
          setIsSong(data.message == "");
          setMessage(data.message);
          setSongName(data.track_title);
          setAlbumName(data.album_title);
          setArtistName(data.artist_name);
      }

      setGetSongTimeout(setTimeout(getSong, 30000));

      if (data.artist_name !== BOT_RESPONSES.dj && data.track_title !== BOT_RESPONSES.song && data.message == "")
      {
        (async () => {
          setImageUrl(await getImage(data.artist_name, data.album_title));
        })();
      } else {
        setImageUrl('img/cassette.png');
      }
    }

    getSong();

    return () => {
      document.removeEventListener('resize', destroyAndBuildNewCanvas);
      if (getSongTimeout) clearTimeout(getSongTimeout);
    }
  }, []);

  useEffect(() => {
    if (playing && audioRef.current) {
      let audioContext = new AudioContext();
      audioRef.current.src = AUDIO_SOURCE;
      audioRef.current.play();
      if (!source.current) {
        source.current = audioContext.createMediaElementSource(audioRef.current);
        analyzer.current = audioContext.createAnalyser();
        source.current.connect(analyzer.current);
        analyzer.current.connect(audioContext.destination);
      }
      visualize();
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, [playing]);

  const visualize = () => {
    animationController = window.requestAnimationFrame(visualize);

    const songData = new Uint8Array(140);
    analyzer.current.getByteFrequencyData(songData);
    const bar_width = 2;
    let start = 0;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    let tone_1 = (theme.palette.mode == "light") ? 25 : 180;
    let tone_2 = (theme.palette.mode == "light") ? 35 : 270;
    for (let i = 0; i < songData.length; i++) {
      start = i * 4;
      ctx.fillStyle = `rgba(${tone_1},${tone_1},${tone_1},0.7)`;
      ctx.fillRect(start, canvasRef.current.height / 2, bar_width, -songData[i] / 9);
      ctx.fillStyle = `rgba(${tone_2},${tone_2},${tone_2},0.7)`;
      ctx.fillRect(start, canvasRef.current.height / 2, bar_width, songData[i] / 9);
    };
  }

    return (
      <>      
      <audio id="now-playing-music" crossOrigin="anonymous" ref={audioRef} ></audio>
      <Card variant="outlined"
        sx = {{
          width: embedded ? '100%' : '225px',
          height: '100%',
          minWidth: '200px',
          minHeight: '225px',
          maxWidth: '500px',
          position: 'relative',
          ...props?.sx
        }}
      >
      <CardOverflow>
        <AspectRatio ratio="2">
          <img
            src={imageUrl}
            loading="lazy"
            alt=""
          />
        <Box
        component="a"
        href="https://www.wxyc.org/"
        target="_blank"
        sx = {{
          position: 'absolute',
          top: '0.3rem',
          left: '1.3rem',
          minWidth: '0.5rem',
          minHeight: '0.5rem',
          borderRadius: '1rem 1rem 1rem 1rem !important',
          '& *': {
            borderRadius: '1rem 1rem 1rem 1rem !important',
          }
        }}
      >
        <AspectRatio ratio="1">
          <img
            src="apple-touch-icon.png"
            loading="lazy"
            alt=""
          />
        </AspectRatio>
      </Box>
        </AspectRatio>
        {embedded && (<IconButton
          aria-label="Like minimal photography"
          size="md"
          variant="solid"
          color="primary"
          sx={{
            position: 'absolute',
            zIndex: 2,
            borderRadius: '50%',
            right: '1rem',
            bottom: 0,
            transform: 'translateY(50%)',
          }}
          onClick = {() => {
            setPlaying(!playing);
          }}
        >
          {playing ? <StopIcon /> : <PlayArrowIcon />}
        </IconButton>)}
        {embedded && (
          <Box
            id="canvas-container"
            sx = {{
              position: 'absolute',
              left: 0,
              width: '100%',
              right: '2rem',
              bottom: 0,
              height: '4rem',
              transform: 'translateY(50%)',
            }}
          >
          </Box>
        )}
      </CardOverflow>
      {(isSong) ? (<CardContent sx = {{ mt: embedded ? 4 : 'unset' }}>
        <Typography level="body1" fontSize="md">
          {songName ?? 'Automatically Chosen Song'}
        </Typography>
        <Stack direction="row">
        <Typography level="body2" sx={{ mt: 0.5 }} color="primary">
          {artistName ?? 'Automatically Chosen Artist'} &nbsp;&nbsp; • &nbsp;&nbsp; {(albumName.length > 0) && albumName}
        </Typography>
        </Stack>
      </CardContent>) : (
        <CardContent sx = {{ mt: embedded ? 4 : 'unset' }}>
        <Typography level="body1" fontSize="md">
          {message}
        </Typography>
      </CardContent>
      )}
      <CardOverflow variant="soft" sx={{ bgcolor: 'background.level1' }}>
        <CardContent orientation="horizontal">
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Typography
            level="body3"
            sx={{ fontWeight: 'md', color: 'text.secondary' }}
          >
            {djName ?? 'No DJ'}
          </Typography>
          </Box>
          <Divider orientation="vertical" />
          <Link
            href="https://www.wxyclistenlive.com/"
            target="_blank"
          >
            <img src='/social-icons/spotify-logo.png' alt="Spotify" 
              style={{ filter: "invert(100%)", WebkitFilter: "invert(100%)", width: '25px', height: '25px' }} 
            />
          </Link>
          <Link
            href="https://www.wxyclistenlive.com/"
            target="_blank"
          >
            <img src='/social-icons/apple-music-logo.png' alt="Apple Music"
              style={{ width: '15px', height: '15px' }}
            />
          </Link>
        </CardContent>
      </CardOverflow>
    </Card>
    </>
  )
}

export default NowPlaying
