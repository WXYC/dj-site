import React, { useEffect } from "react"
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
import { Box } from "@mui/joy";
import { getArtwork } from "../../services/artwork/artwork-service";

let animationController = null;

const BOT_RESPONSES = {
  song: 'Random Selection',
  dj: '🤖 Auto DJ',
}

const NowPlaying = () => {

  const songName = BOT_RESPONSES.song;
  const artistName = '';
  const djName = BOT_RESPONSES.dj;

  const [imageUrl, setImageUrl] = React.useState('img/cassette.png');

  const [playing, setPlaying] = React.useState(false);
  const [embedded, setEmbedded] = React.useState(true);

  const AUDIO_SOURCE = 'https://audio-mp3.ibiblio.org/wxyc.mp3';

  const analyzer = React.useRef(null);
  const audioRef = React.useRef(null);
  const source = React.useRef(null);

  const canvasRef = React.useRef(null);

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

  const getImageArtwork = async () => {
    let imgUrl = await getArtwork({
      artist: artistName,
      title: songName,
    });
    setImageUrl(imgUrl ?? 'img/cassette.png');
  };

  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch (e) {
      setEmbedded(true);
    }
    destroyAndBuildNewCanvas();
    document.addEventListener('resize', destroyAndBuildNewCanvas);

    if (djName !== BOT_RESPONSES.dj && songName !== BOT_RESPONSES.song)
      getImageArtwork();

    return () => {
      document.removeEventListener('resize', destroyAndBuildNewCanvas);
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
    for (let i = 0; i < songData.length; i++) {
      start = i * 4;
      ctx.fillStyle = 'rgba(180,180,180,0.7)';
      ctx.fillRect(start, canvasRef.current.height / 2, bar_width, -songData[i] / 9);
      ctx.fillStyle = 'rgba(270,270,270,0.5)';
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
        }}
      >
      <CardOverflow>
        <AspectRatio ratio="2">
          <img
            src={imageUrl}
            loading="lazy"
            alt=""
          />
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
      <CardContent sx = {{ mt: embedded ? 4 : 'unset' }}>
        <Typography level="body1" fontSize="md">
          {songName ?? 'Automatically Chosen Song'}
        </Typography>
        <Typography level="body2" sx={{ mt: 0.5 }} color="primary">
          {artistName ?? 'Automatically Chosen Artist'}
        </Typography>
      </CardContent>
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
