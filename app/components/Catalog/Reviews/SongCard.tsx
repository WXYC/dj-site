import { AspectRatio, Button, Card, CardContent, CardOverflow, Divider, Input, Stack, Textarea, Tooltip } from '@mui/joy';
import Box from '@mui/joy/Box';
import IconButton from '@mui/joy/IconButton';
import Typography from '@mui/joy/Typography';
import { useCallback, useEffect, useState } from 'react';


import { ArtistAvatar } from '../ArtistAvatar';

import { CatalogResult, applicationSlice, getArtwork, getAuthenticatedUser, useDispatch, useSelector } from '@/lib/redux';
import { timeout } from '@/lib/utilities/timeout';
import { ArrowBack, Inventory, PlayArrow, QueueMusic } from '@mui/icons-material';
import { Review } from './Review';

type SongCardContentProps = {
  songCardContent: CatalogResult | undefined;
}

export default function SongCard(props: SongCardContentProps) : JSX.Element {
  const [image, setImage] = useState<string | null>(null);

  const dispatch = useDispatch();

  const user = useSelector(getAuthenticatedUser);

  const getImage = useCallback(
    async (default_return = "") => {
      if (
        props.songCardContent?.album == undefined ||
        props.songCardContent?.album.artist == undefined
      )
        return default_return;

      await timeout(Math.random() * 800);

      let storedArtwork = sessionStorage.getItem(
        `img-${props.songCardContent?.album.title}-${props.songCardContent?.album.artist.name}`
      );
      if (storedArtwork) return storedArtwork;
      try {
        let retrievedArtwork = await getArtwork(props.songCardContent?.album.title, props.songCardContent?.album.artist.name);
        if (retrievedArtwork == null) retrievedArtwork = default_return;
        // THE CONVENTION IS ALBUM THEN ARTIST IN THIS APP
        sessionStorage.setItem(
          `img-${props.songCardContent?.album.title}-${props.songCardContent?.album.artist.name}`,
          retrievedArtwork
        );
        return retrievedArtwork;
      } catch (e) {
        sessionStorage.setItem(
          `img-${props.songCardContent?.album.title}-${props.songCardContent?.album.artist.name}`,
          default_return
        );
        return default_return;
      }
    },
    [props.songCardContent?.album]
  );

  useEffect(() => {
    getImage("/img/cassette.png").then((image: string) => {
      setImage(image);
    });
  }, [getImage]);

  return (
    <Box>
    <Card variant='plain'>
        <CardOverflow>
            <AspectRatio ratio={2}>
                <img src = {image ?? "/img/cassette.png"} alt = {props.songCardContent?.album.title} />
            </AspectRatio>
            <Stack direction='row' sx = {{ 
              position: 'absolute',
              top: 5,
              right: 5,
              justifyContent: 'space-between' 
            }}>
              <IconButton 
                variant="solid"
                color="primary"
                onClick={() => dispatch(applicationSlice.actions.closeSideBar())}
              >
                <ArrowBack />
              </IconButton>
            </Stack>
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
                    artist={props.songCardContent?.album.artist!}
                    entry={props.songCardContent?.album.release!}
                    format={props.songCardContent?.album.format}
                />
            </Box>
            <Box sx = {{ justifyContent: 'flex-end' }}>
            <Typography level="title-md" sx = {{ pl: '35%', textAlign: 'right', textWrap: 'wrap' }}>{props.songCardContent?.album.title}</Typography>
            <Typography level="body-sm" sx = {{ pl: '35%', textAlign: 'right', textWrap: 'wrap' }}>{props.songCardContent?.album.artist?.name}</Typography>
            </Box>
        </CardContent>
        <CardOverflow variant="soft" sx={{ bgcolor: 'background.level1', borderRadius: 0 }}>
        <Divider inset="context" />
        <CardContent orientation="horizontal"
          sx = {{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 0.5
          }}
        >
          <Typography level="body-xs" fontWeight="md" textColor="text.secondary">
            0 plays
          </Typography>
          <Divider orientation="vertical" />
          <Stack direction="row" spacing={0.5}>
          <Tooltip title="Will add to queue">
                          <IconButton onClick={() => {}}>
                            <QueueMusic />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Will add to bin">
                          <IconButton onClick={() => {}}>
                            <Inventory />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Will play this album">
                          <IconButton onClick={() => {}}>
                            <PlayArrow />
                          </IconButton>
                        </Tooltip>
          </Stack>
            <Divider orientation="vertical" />
            <Typography level="body-xs" fontWeight="md" textColor="text.secondary">
              C# {props.songCardContent?.id}
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
          width: 270,
          overflowY: 'scroll',
          height: '100%',
          maxHeight: 320,
        }}>
      {props.songCardContent?.reviews?.map((review, index) => (
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