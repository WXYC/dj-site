import React, { createContext, useCallback, useEffect, useState } from 'react';
import Modal from '@mui/joy/Modal';
import { Card, CardOverflow, AspectRatio, Typography, Divider, ModalClose, Box, CardContent, Chip, Button } from '@mui/joy';
import { getArtwork } from '../../services/artwork/artwork-service';
import { ArtistAvatar } from './ArtistAvatar';
import { ClickAwayListener, Stack } from '@mui/material';

const SongCardContext = createContext();


const SongCardProvider = ({ children }) => {

    const [songCardContent, setSongCardContent] = useState(undefined);
    const [songCardOpen, setSongCardOpen] = useState(false);

    const [image, setImage] = useState("");

    const getSongCardContent = (song) => {
        setSongCardContent(song);
        setSongCardOpen(true);
    };

    const getImage = useCallback(async () => {
        if (songCardContent == {} || songCardContent == undefined) return "";
        let storedArtwork = sessionStorage.getItem(
          `img-${songCardContent.title}-${songCardContent.artist.name}`
        );
        if (storedArtwork) return storedArtwork;
        try {
          let retrievedArtwork = await getArtwork({
            title: songCardContent.title,
            artist: songCardContent.artist.name,
          });
          // THE CONVENTION IS ALBUM THEN ARTIST IN THIS APP
          sessionStorage.setItem(
            `img-${songCardContent.title}-${songCardContent.artist.name}`,
            retrievedArtwork
          );
          return retrievedArtwork;
        } catch (e) {
          sessionStorage.setItem(
            `img-${songCardContent.title}-${songCardContent.artist.name}`,
            ""
          );
          return "";
        }
      }, [songCardContent]);

    useEffect(() => {
        getImage().then((img) => setImage(img));
    }, [songCardContent]);

    const contextValue = {
        getSongCardContent,
    };

    return (
        <SongCardContext.Provider value={contextValue}>
            <Modal
                open={songCardOpen}
                sx = {{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
            <ClickAwayListener onClickAway={() =>{
                setSongCardOpen(false);
                setSongCardContent(undefined);
            }
        }>
                <Card
                    variant="outlined"
                    sx = {{
                        width: '50%',
                        height: 500,
                        transform: {
                            xs: 'translateX(0)',
                            md: 'translateX(-100px)',
                        }
                    }}
                >
                    <CardOverflow>
                        <AspectRatio ratio="4">
                            <img src={image.length > 0 ? image : 'img/wxyc_dark.jpg'} />
                        </AspectRatio>
                        <Box
                            sx = {{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                borderTopRightRadius: 'var(--CardOverflow-radius)',
                                borderTopLeftRadius: 'var(--CardOverflow-radius)',
                                backdropFilter: 'blur(0.2rem)',
                                pointerEvents: 'none'
                            }}
                        ></Box>
                        <Box
                            sx = {{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                borderTopRightRadius: 'var(--CardOverflow-radius)',
                                borderTopLeftRadius: 'var(--CardOverflow-radius)',
                                bgcolor: 'rgba(0,0,0,0.5)'
                            }}
                        ></Box>
                        <Box
                            sx = {{
                                position: 'absolute',
                                bottom: 3,
                                left: 0,
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'flex-start',
                            }}
                        >                            
                            {(songCardContent != undefined) && (
                            <Box 
                                sx = {{ 
                                    ml: 5,
                                    width: 70,
                                    '& > *' : {
                                    transform: 'scale(1.8) translateY(13px)',
                                    }
                                }}
                            >
                            <ArtistAvatar
                                artist={songCardContent.artist}
                                format={songCardContent.format}
                                entry={songCardContent.release_number}
                            />
                            </Box>)}
                            <Typography level="body1" 
                                sx={{ 
                                    color: 'white',
                                    overflow: 'hidden',
                                    lineHeight: '1.5em',
                                    height: '3em',
                                    pl: 3.2,
                                    textOverflow: 'ellipsis',
                                    fontSize: '1.5rem',
                                    maxWidth: 'calc(100% - 40px)'
                                }}>
                                {(songCardContent != undefined) && songCardContent.title}
                            </Typography>
                        </Box>
                        <ModalClose 
                            variant="solid"
                            onClick={() =>{
                                setSongCardOpen(false);
                                setSongCardContent(undefined);
                            }}
                        />
                    </CardOverflow>
                    <CardContent>
                        <Stack direction="row" spacing={2}
                            sx = {{
                                ml: 12,
                                mb: 1,
                            }}
                        >
                            {(songCardContent != undefined) && (<Typography level="body1">
                                {songCardContent.artist.name} &nbsp;&nbsp; • &nbsp;&nbsp; {songCardContent.artist.genre} {songCardContent.artist.lettercode} {songCardContent.numbercode}/{songCardContent.release_number} &nbsp;&nbsp; • &nbsp;&nbsp; {songCardContent?.format ?? ''}
                            </Typography>)}
                            <Button
                                size="xs"
                                variant="soft"
                                color="primary"
                                disabled
                            >
                                Find in Station
                            </Button>
                            </Stack>
                        No Reviews Yet!
                    </CardContent>
                    <CardOverflow
                        variant="soft"
                        sx={{
                        display: 'flex',
                        gap: 1.5,
                        py: 1.5,
                        px: 'var(--Card-padding)',
                        bgcolor: 'background.level1',
                        }}
                    >
                        <Typography level="body3" sx={{ fontWeight: 'md', color: 'text.secondary' }}>
                        0 plays
                        </Typography>
                        <Divider orientation="vertical" />
                        <Typography level="body3" sx={{ fontWeight: 'md', color: 'text.secondary' }}>
                        Added in Dates Not Implemented Yet
                        </Typography>
                    </CardOverflow>
                </Card>
                </ClickAwayListener>
            </Modal>
            {children}
        </SongCardContext.Provider>
    )
}

export { SongCardProvider, SongCardContext };
