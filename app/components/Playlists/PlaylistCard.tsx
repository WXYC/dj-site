'use client';
import { getArtwork, getAuthenticatedUser, useSelector } from '@/lib/redux';
import HeadsetIcon from '@mui/icons-material/Headset';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { AspectRatio, Box, Card, CardCover, CardOverflow, Typography } from "@mui/joy";
import { useCallback, useEffect, useState } from "react";


interface PlaylistPreviewProps {

}

interface PlaylistAlbumInfoProps {
    title: string;
    artist: string;
}

const PlaylistCard = (props: PlaylistPreviewProps) => {
        const [images, setImages] = useState([]);

        const user = useSelector(getAuthenticatedUser);

        const chooseImages = useCallback(async (information: PlaylistAlbumInfoProps[]) => {
            return Array.from(
                await Promise.all(
                    information.map(async (info) => {
                        let storedArtwork = sessionStorage.getItem(`img-${info.title}-${info.artist}`);
                        if (storedArtwork) return storedArtwork;
                        try {
                            let retrievedArtwork = await getArtwork(
                                info.title,
                                info.artist
                            );
                            sessionStorage.setItem(`img-${info.title}-${info.artist}`, retrievedArtwork);
                            return retrievedArtwork;
                        } catch (e) {
                            sessionStorage.setItem(`img-${info.title}-${info.artist}`, 'img/cassette.png');
                            return '';
                        }
                    })
                )
            );
        }, []);
    
        const getImages = useCallback(async () => {
            const imageList = await chooseImages(
                props.playlist.previewArtists.map((artist, index) => ({
                    title: props.playlist.previewAlbums[index],
                    artist: artist
                }))
            );
            setImages(imageList);
        }, [props.playlist, chooseImages]);
    
        useEffect(() => {
            getImages();
        }, [getImages]);
    
        return (
           
            <Card 
                sx={{ 
                    p: 1,
                    cursor: 'pointer',
                }}
                onClick={() => {
                    navigate(`/playlists/${user.djName}/${playlist.id}`);
                }}
            >
                <CardOverflow>
                    <AspectRatio ratio={1}>
                    <Box
                        sx = {{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexWrap: 'wrap',
                        }}
                    >
                    {
                        images.map((image, index) => (
                            <AspectRatio
                                key={index}
                                ratio={1}
                                sx = {{
                                    flexBasis: '50%',
                                    mx: 0,
                                    borderRadius: 0,
                                }}
                            >
                                <img src={image} />
                            </AspectRatio>
                        ))
                    }
                    </Box>
                    </AspectRatio>
                    <CardCover
                        sx={{
                        background:
                            'linear-gradient(to top, rgba(0,0,0,0.4), rgba(0,0,0,0) 200px), linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0) 300px)',
                        }}
                    />
                    <CardCover>
                        <Box
                            sx = {{
                                display: 'flex',
                                alignItems: 'flex-end !important',
                                justifyContent: 'flex-start!important',
                                p: 1,
                            }}
                        >
                            <Box
                                sx = {{
                                    mb: 3,
                                    ml: 3,
                                }}
                            >
                                <Typography
                                    level="body-lg"
                                    textColor={'white'}
                                >
                                    {playlist.name}
                                </Typography>
                                <Typography
                                    startDecorator = {<HeadsetIcon />}
                                    level="body-xs"
                                >
                                    {playlist.djs.join(', ')}
                                </Typography>
                                <Typography
                                    startDecorator = {<ScheduleIcon />}
                                    level="body-xs"
                                >
                                    {new Date(playlist.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </Typography>
                                <Typography
                                    startDecorator = {<LibraryMusicIcon />}
                                    level="body-xs"
                                >
                                    {playlist.previewArtists.join(', ')}
                                </Typography>
                            </Box>
                        </Box>
                    </CardCover>
                </CardOverflow>
            </Card>
    )
}

export default PlaylistCard;