import { AspectRatio, Box, Card, CardContent, CardCover, CardOverflow, Grid, Link, Sheet, Typography } from "@mui/joy";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getArtwork } from "../../services/artwork/artwork-service";
import ScheduleIcon from '@mui/icons-material/Schedule';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import HeadsetIcon from '@mui/icons-material/Headset';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../services/authentication/authentication-context";

/**
 * Represents a playlist card component.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {Object} props.playlist - The playlist object.
 * @returns {JSX.Element} The playlist card component.
 */
const PlaylistCard = ({ playlist }) => {

    const [images, setImages] = useState([]);

    const navigate = useNavigate();
    const { user } = useAuth();

    /**
     * Chooses and retrieves artwork images for the playlist.
     *
     * @param {Array} information - The information array containing title and artist for each preview album.
     * @returns {Promise<Array>} A promise that resolves to an array of artwork images.
     */
    const chooseImages = useCallback(async (information) => {
        console.log(information);
        return Array.from(
            await Promise.all(
                information.map(async (info) => {
                    let storedArtwork = sessionStorage.getItem(`img-${info.title}-${info.artist}`);
                    if (storedArtwork) return storedArtwork;
                    try {
                        let retrievedArtwork = await getArtwork({
                            title: info.title,
                            artist: info.artist
                        });
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
            playlist.previewArtists.map((artist, index) => ({
                title: playlist.previewAlbums[index],
                artist: artist
            }))
        );
        setImages(imageList);
    }, [playlist, chooseImages]);

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
                                level="body1"
                                textColor={'white'}
                            >
                                {playlist.name}
                            </Typography>
                            <Typography
                                startDecorator = {<HeadsetIcon />}
                                level="body4"
                            >
                                {playlist.djs.join(', ')}
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