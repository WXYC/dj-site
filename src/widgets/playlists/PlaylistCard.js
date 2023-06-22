import { AspectRatio, Box, Card, CardContent, CardCover, CardOverflow, Grid, Link, Sheet, Typography } from "@mui/joy";
import React, { useEffect } from "react";
import { getArtwork } from "../../services/artwork/artwork-service";
import ScheduleIcon from '@mui/icons-material/Schedule';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';

const PlaylistCard = ({ playlist }) => {

    const [images, setImages] = React.useState([]);

    const chooseImages = async (information) => {
        return Array.from(
           await Promise.all(
                information.map(async (info) => {
                    return await getArtwork({
                        title: info.title,
                        artist: info.artist
                    });
                }
            )
        ));
    }

    useEffect(() => {
        const getImages = async () => {
            chooseImages(playlist.previewArtists.map((artist, index) => {
                return {
                    title: playlist.previewAlbums[index],
                    artist: artist
                }
            })).then((images) => {
                setImages(images);
                console.log(images);
            });
        }
        getImages();
    }, [playlist]);

    return (
                
        <Card 
            sx={{ 
                p: 1,
                cursor: 'pointer',
            }}
            onClick={() => {
                console.log("Clicked");
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
                                level="body1"
                            >
                                {playlist.name}
                            </Typography>
                            <Typography
                                startDecorator = {<ScheduleIcon />}
                                level="body4"
                            >
                                {new Date(playlist.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </Typography>
                            <Typography
                                startDecorator = {<LibraryMusicIcon />}
                                level="body5"
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