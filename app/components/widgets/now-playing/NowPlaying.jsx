import { getArtwork, getNowPlayingFromBackend } from "@/lib/services";
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
import React, { useCallback, useEffect } from "react";

let animationController = null;

const NowPlaying = (props) => {

  const [songName, setSongName] = React.useState('Random Selection');
  const [albumName, setAlbumName] = React.useState('');
  const [artistName, setArtistName] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [imageUrl, setImageUrl] = React.useState('/img/cassette.png');

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

  const canvasRef = React.useRef(null);

  const [hovered, setHovered] = React.useState(false)

  const theme = useTheme();
  const { mode, setMode } = useColorScheme();

  const search = useSearchParams();

  const [fadeTimeout, setFadeTimeout] = React.useState(null);

  const destroyAndBuildNewCanvas = useCallback(() => {
    let container = document.getElementById('canvas-container');
    if (container) {
      container.innerHTML = '';
      canvasRef.current = document.createElement('canvas');
      if (props.mini)
      {
        canvasRef.current.width = container.clientWidth - 5;
        canvasRef.current.marginLeft = 5;
        canvasRef.current.height = container.clientHeight;
      }
      else {
        canvasRef.current.width = container.clientWidth - 40;
        canvasRef.current.height = container.clientHeight;
      }
      container.appendChild(canvasRef.current);
    }
  }, [props.mini]);

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
          setImageUrl(await getImage(data.artist_name, data.album_title, '/img/cassette.png'));
        })();
    }

    getSong();
    setGetSongInterval(setInterval(getSong, 30000));

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
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, [playing]);

  useEffect(() => {
    if (playing && audioRef.current) {
      destroyAndBuildNewCanvas();
      visualize();
    }
  }, [playing, props.mini, theme.palette.mode]);

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

  const visualize = useCallback(() => {

    if (!canvasRef.current) return;
    if (!analyzer.current) return;

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
      let height = props.mini ? canvasRef.current.height - 1 : canvasRef.current.height / 2;
      ctx.fillRect(start, height, bar_width, -songData[i] / 9);
      if (!props.mini)
      {
        ctx.fillStyle = `rgba(${tone_2},${tone_2},${tone_2},0.7)`;
        ctx.fillRect(start, canvasRef.current.height / 2, bar_width, songData[i] / 9);
      }
    };
  }, [canvasRef.current, theme.palette.mode, analyzer.current, props.mini]);

    return (
      <>      
      <audio id="now-playing-music" crossOrigin="anonymous" ref={audioRef} ></audio>
      {(props.mini) ? (
        <Card orientation="horizontal" variant="outlined" sx={{ width: 295 }}
          onMouseEnter = {() => setHovered(true)}
          onMouseLeave = {() => setHovered(false)}
        >
        <CardOverflow>
        <AspectRatio ratio="1" sx={{ width: 90 }}>
          <img
            src={imageUrl}
            loading="lazy"
            alt={imageUrl}
          />
          {(hovered) && (<IconButton
            size="lg"
            variant="solid"
            color="primary"
            sx={{
              position: "absolute",
              zIndex: 2,
              top: '50%',
              left: '50%',
              transform: "translate(-50%, -50%)",
            }}
            onClick={() => {
              setPlaying(!playing);
            }}
          >
            {playing ? <StopIcon /> : <PlayArrowIcon />}
        </IconButton>)}
        </AspectRatio>
      </CardOverflow>
      {(isSong) ? (
      <CardContent>
        <Typography level="body-md" fontSize="lg" ref={upperText} sx = {{ whiteSpace: 'nowrap' }}>
          {upperTextMarquee ? (
            <marquee>{songName ?? 'Automatically Chosen Song'}</marquee>
          ): (
            <>{songName ?? 'Automatically Chosen Song'}</>
          )}
        </Typography>
        <Stack direction="row">
        <Typography level="body-md" sx={{ whiteSpace: 'nowrap', overflow: 'hidden' }} color="primary" ref={lowerText}>
          {lowerTextMarquee ? (
            <marquee>{artistName ?? 'Automatically Chosen Artist'} &nbsp;&nbsp; • &nbsp;&nbsp; {(albumName.length > 0) && albumName}</marquee>
          ): (
            <>{artistName ?? 'Automatically Chosen Artist'} &nbsp;&nbsp; • &nbsp;&nbsp; {(albumName.length > 0) && albumName}</>
          )}
        </Typography>
        </Stack>
      </CardContent>) : (
        <CardContent
          sx = {{
            maxHeight: 45
          }}
        >
          <Typography
            component="div"
            level="body-md"
          >
          <marquee>{message}</marquee>
        </Typography>
      </CardContent>
      )}
      <Box
            component={"div"}
            id = "canvas-container"
            sx = {{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          ></Box>
          <CardOverflow
        variant="soft"
        color={message.includes("End of Show") ? "error" : "primary"}
        sx={{
          px: 0.2,
          writingMode: 'vertical-rl',
          justifyContent: 'center',
          fontSize: 'xs',
          fontWeight: 'xl',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          borderLeft: '1px solid',
          borderColor: 'divider',
        }}
      >
        {message.includes("End of Show") ? "Off Air" : "On Air"}
      </CardOverflow>
        </Card>
      ) : (<Card variant="outlined"
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
            alt={imageUrl}
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
                alt={imageUrl}
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
        <Typography level="body-lg" fontSize="lg" ref={upperText} sx = {{ whiteSpace: 'nowrap' }}>
          {upperTextMarquee ? (
            <marquee>{songName ?? 'Automatically Chosen Song'}</marquee>
          ): (
            <>{songName ?? 'Automatically Chosen Song'}</>
          )}
        </Typography>
        <Stack direction="row">
        <Typography level="body-md" sx={{ mt: 0.5, whiteSpace: 'nowrap', overflow: 'hidden' }} color="primary" ref={lowerText}>
          {lowerTextMarquee ? (
            <marquee>{artistName ?? 'Automatically Chosen Artist'} &nbsp;&nbsp; • &nbsp;&nbsp; {(albumName.length > 0) && albumName}</marquee>
          ): (
            <>{artistName ?? 'Automatically Chosen Artist'} &nbsp;&nbsp; • &nbsp;&nbsp; {(albumName.length > 0) && albumName}</>
          )}
        </Typography>
        </Stack>
      </CardContent>) : (
        <CardContent sx = {{ mt: embedded ? 4 : 'unset' }}>
        <Typography level="body-lg" fontSize="md">
          {message}
        </Typography>
      </CardContent>
      )}
      <CardOverflow variant={message.includes("End of Show") ? "solid" : "soft"} color={message.includes("End of Show") ? "neutral" : "primary"}>
        <CardContent orientation="horizontal">
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Typography
            level="body3"
            sx={{ fontWeight: 'md', color: 'text.secondary',
              textTransform: 'uppercase',
             }}
          >
            {message.includes("End of Show") ? "Off Air" : "On Air"}
          </Typography>
          </Box>
        </CardContent>
      </CardOverflow>
    </Card>)}
    </>
  )
}

export default NowPlaying
