import { getArtwork } from "@/lib/services";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { Box, Stack, useColorScheme, useTheme } from "@mui/joy";
import AspectRatio from '@mui/joy/AspectRatio';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import CardOverflow from '@mui/joy/CardOverflow';
import IconButton from '@mui/joy/IconButton';
import Typography from '@mui/joy/Typography';
import { useSearchParams } from "next/navigation";
import React, { useEffect } from "react";
import { getDJListFromBackend, getNowPlayingFromBackend } from "../../services/flowsheet/flowsheet-service";

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

  const upperText = React.useRef(null);
  const [upperTextMarquee, setUpperTextMarquee] = React.useState(false);
  const lowerText = React.useRef(null);
  const [lowerTextMarquee, setLowerTextMarquee] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const theme = useTheme();
  const { mode, setMode } = useColorScheme();

  const search = useSearchParams();

  const [fadeTimeout, setFadeTimeout] = React.useState(null);

  const destroyAndBuildNewCanvas = () => {
    let container = document.getElementById('canvas-container');
    if (container) {
      container.innerHTML = '';
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = container.clientWidth - 40;
      canvasRef.current.height = container.clientHeight;
      container.appendChild(canvasRef.current);
    }
  }

  const getImage = async (artist, album, default_return = "") => {
    if (album == undefined || artist == undefined) return default_return;
    if (artist == "" || album == "") return default_return;
    let storedArtwork = sessionStorage.getItem(
      `img-${album}-${artist}`
    );
    if (storedArtwork) return storedArtwork;
    try {
      let retrievedArtwork = await getArtwork(album, artist);
      // THE CONVENTION IS ALBUM THEN ARTIST IN THIS APP
      sessionStorage.setItem(
        `img-${album}-${artist}`,
        retrievedArtwork
      );
      return retrievedArtwork;
    } catch (e) {
      sessionStorage.setItem(
        `img-${album}-${artist}`,
        default_return
      );
      return default_return;
    }
  };

  const [getSongInterval, setGetSongInterval] = React.useState(null);
  const [getDJListInterval, setgetDJListInterval] = React.useState(null);
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
          setIsSong(!data.message);
          setMessage(data.message);
          setSongName(data.track_title);
          setAlbumName(data.album_title);
          setArtistName(data.artist_name);
      }

        (async () => {
          setImageUrl(await getImage(data.artist_name, data.album_title, 'img/cassette.png'));
        })();
    }

    getSong();
    setGetSongInterval(setInterval(getSong, 30000));

    const getDJList = async () => {
      const { data, error } = await getDJListFromBackend();

      if (error) {
        console.error(error);
        setDjName(BOT_RESPONSES.dj);
      }

      if (data) {
        setDjName(data.dj_name);
      }
    }

    getDJList();
    setgetDJListInterval(setInterval(getDJList, 30000));

    var query = window.location.search.substring(1);
    var vars = query.split("&");
    var pair = vars[0].split("=");
    for (var i = 0; i < vars.length; i++) {
      pair = vars[i].split("=");
      if(pair[0] == "theme") {
        setMode(pair[1]);
      }
    }

    return () => {
      document.removeEventListener('resize', destroyAndBuildNewCanvas);
      if (getSongInterval) clearInterval(getSongInterval);
      if (getDJListInterval) clearInterval(getDJListInterval);
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

  useEffect(() => {
    const isOverflowing = (element) => {
      if (element == null) return false;
      return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
    }

    setUpperTextMarquee(isOverflowing(upperText.current));
    setLowerTextMarquee(isOverflowing(lowerText.current));

  }, [songName, albumName, artistName, message]);

  useEffect(() => {
    let query = new URLSearchParams(search);
    let theme = query.get('theme');
    if (theme) {
      setMode(theme);
    }
  }, [search]);

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
        <AspectRatio ratio="2"
        >
          <img
            src={imageUrl}
            loading="lazy"
            alt=""
            style={{
              filter: isSong ? 'blur(10px)' : 'none',
              zIndex: 0,
            }}
          />
          {(isSong) && (<Box
            sx = {{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: '5%',
            }}
          >
            <AspectRatio ratio="1"
              style={{
                width: '50%',
                borderRadius: '1rem',
                boxShadow: '0 0 1.5rem 0 rgba(0, 0, 0, 0.4)',
              }}
            >
              <img
                src={imageUrl}
                loading="lazy"
                alt=""
              />
            </AspectRatio>
          </Box>)}
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
      {(isSong) ? (
      <CardContent 
        sx = {{ 
          mt: embedded ? 4 : 'unset', 
          whiteSpace: 'nowrap', 
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Typography level="body1" fontSize="lg" ref={upperText} sx = {{ whiteSpace: 'nowrap' }}>
          {upperTextMarquee ? (
            <marquee>{songName ?? 'Automatically Chosen Song'}</marquee>
          ): (
            <>{songName ?? 'Automatically Chosen Song'}</>
          )}
        </Typography>
        <Stack direction="row">
        <Typography level="body2" sx={{ mt: 0.5, whiteSpace: 'nowrap', overflow: 'hidden' }} color="primary" ref={lowerText}>
          {lowerTextMarquee ? (
            <marquee>{artistName ?? 'Automatically Chosen Artist'} &nbsp;&nbsp; • &nbsp;&nbsp; {(albumName.length > 0) && albumName}</marquee>
          ): (
            <>{artistName ?? 'Automatically Chosen Artist'} &nbsp;&nbsp; • &nbsp;&nbsp; {(albumName.length > 0) && albumName}</>
          )}
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
        </CardContent>
      </CardOverflow>
    </Card>
    </>
  )
}

export default NowPlaying
