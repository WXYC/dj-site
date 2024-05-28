import { AspectRatio, Button, Card, CardContent, CardOverflow, Divider, Input, Stack, Textarea } from '@mui/joy';
import Box from '@mui/joy/Box';
import IconButton from '@mui/joy/IconButton';
import Typography from '@mui/joy/Typography';
import { useCallback, useEffect, useState } from 'react';


import { ArtistAvatar } from '../ArtistAvatar';

import { applicationSlice, getArtwork, getAuthenticatedUser, getSongCardContent, useDispatch, useSelector } from '@/lib/redux';
import { timeout } from '@/lib/utilities/timeout';
import { ArrowBack } from '@mui/icons-material';
import { Review } from './Review';

export default function SongCard() : JSX.Element {
  const [image, setImage] = useState<string | null>(null);

  const dispatch = useDispatch();
  const songCardContent = useSelector(getSongCardContent);

  const user = useSelector(getAuthenticatedUser);

  const getImage = useCallback(
    async (default_return = "") => {
      if (
        songCardContent.album == undefined ||
        songCardContent.album.artist == undefined
      )
        return default_return;

      await timeout(Math.random() * 800);

      let storedArtwork = sessionStorage.getItem(
        `img-${songCardContent.album.title}-${songCardContent.album.artist.name}`
      );
      if (storedArtwork) return storedArtwork;
      try {
        let retrievedArtwork = await getArtwork(songCardContent.album.title, songCardContent.album.artist.name);
        if (retrievedArtwork == null) retrievedArtwork = default_return;
        // THE CONVENTION IS ALBUM THEN ARTIST IN THIS APP
        sessionStorage.setItem(
          `img-${songCardContent.album.title}-${songCardContent.album.artist.name}`,
          retrievedArtwork
        );
        return retrievedArtwork;
      } catch (e) {
        sessionStorage.setItem(
          `img-${songCardContent.album.title}-${songCardContent.album.artist.name}`,
          default_return
        );
        return default_return;
      }
    },
    [songCardContent.album]
  );

  useEffect(() => {
    getImage("/img/cassette.png").then((image: string) => {
      setImage(image);
    });
  }, [getImage]);

  return (
    <Box>
    <Stack direction='row' sx = {{ p: 2, pt: 3, justifyContent: 'space-between' }}>
      <IconButton onClick={() => dispatch(applicationSlice.actions.closeSongCard())}>
        <ArrowBack />
      </IconButton>
    </Stack>
    <Card variant='plain'>
        <CardOverflow>
            <AspectRatio ratio={2}>
                <img src = {image ?? undefined} alt = {songCardContent.album.title} />
            </AspectRatio>
        </CardOverflow>
        <CardContent sx = {{ mt: 0 }}>
            <Box sx = {{
                position: 'absolute',
                ml: '5%', 
                transform: 'translateY(-75%)',
                '& > * > .MuiAvatar-root': {
                    transform: 'scale(1.5)',
                }
            }}>
                <ArtistAvatar 
                    artist={songCardContent.album.artist}
                    entry={songCardContent.album.release}
                    format={songCardContent.album.format}
                />
            </Box>
            <Box sx = {{ justifyContent: 'flex-end' }}>
            <Typography level="title-md" sx = {{ pl: '35%', textAlign: 'right', textWrap: 'wrap' }}>{songCardContent.album.title}</Typography>
            <Typography level="body-sm" sx = {{ pl: '35%', textAlign: 'right', textWrap: 'wrap' }}>{songCardContent.album.artist?.name}</Typography>
            </Box>
        </CardContent>
        <CardOverflow variant="soft" sx={{ bgcolor: 'background.level1', borderRadius: 0 }}>
        <Divider inset="context" />
        <CardContent orientation="horizontal">
          <Typography level="body-xs" fontWeight="md" textColor="text.secondary">
            0 plays
          </Typography>
          <Divider orientation="vertical" />
          <Typography level="body-xs" fontWeight="md" textColor="text.secondary">
            Entry #{songCardContent?.id} in our catalog
          </Typography>
        </CardContent>
        <Divider inset="context" />
      </CardOverflow>
    </Card>
    <Stack direction="column" 
    spacing={1}
        sx = {{
          p: 0.5,
          maxWidth: 300,
          width: '100%',
          overflowY: 'scroll',
          height: '100%',
          maxHeight: 300,
        }}>
      {songCardContent.reviews?.map((review, index) => (
        <Review
          key={index}
          username={review.username}
          content={review.content}
          recommends={review.recommends ?? []}
        />
      )) ?? (<Typography level="body-md" sx = {{ p: 3 }}>
        No reviews yet. Feel free to leave one!
      </Typography>)}
      </Stack>
      <Stack spacing={2} direction="column" justifyContent="space-between" sx = {{ p: 2, minHeight: 100 }}>
        <Box
          component="form"
          sx = {{
            '& > *': {
              fontSize: '0.8rem'
            },
          }}
        >
          <Input required placeholder="Name" defaultValue={user?.username} />
          <Textarea required minRows={3} placeholder="Leave a review..." sx = {{ mt: 1, fontSize: '0.8rem' }} />
          <Button variant="soft" color="primary" sx = {{ mt: 1 }}>Submit</Button>
        </Box>
      </Stack>
  </Box>
  );
}