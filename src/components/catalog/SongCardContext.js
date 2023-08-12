import React, { createContext, useCallback, useEffect, useState } from 'react';
import Modal from '@mui/joy/Modal';
import { Card, CardOverflow, AspectRatio, Typography, Divider, ModalClose, Box, CardContent } from '@mui/joy';
import { getArtwork } from '../../services/artwork/artwork-service';
import { ArtistAvatar } from './ArtistAvatar';

const SongCardContext = createContext();

/**
 * @deprecated This component is deprecated and no longer recommended for use.
 *
 * @component
 * @example
 * // Usage example:
 * import { SongCardProvider, SongCardContext } from './SongCardProvider';
 *
 * function App() {
 *   return (
 *     <SongCardProvider>
 *       <SongCardContext.Consumer>
 *         {({ getSongCardContent }) => (
 *           <div>
 *             <button onClick={() => getSongCardContent(song)}>Open Song Card</button>
 *           </div>
 *         )}
 *       </SongCardContext.Consumer>
 *     </SongCardProvider>
 *   );
 * }
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to render within the provider.
 *
 * @returns {JSX.Element} The rendered SongCardProvider component.
 *
 * @description
 * The SongCardProvider component is a deprecated component that provides the ability to store song information in context and render it as a modal on the Dashboard.
 *
 * ⚠️ **Deprecated**: This component is no longer recommended for use. Consider using an alternative solution.
 *
 * @deprecated
 * This component has been deprecated and should not be used in new code. It may be removed in future versions.
 *
 * @context
 * The SongCardContext provides the following context value:
 *
 * ```javascript
 * {
 *   getSongCardContent: (song) => void
 * }
 * ```
 *
 * @example
 * // Usage example:
 * import { useContext } from 'react';
 * import { SongCardContext } from './SongCardProvider';
 *
 * function SongCard() {
 *   const { getSongCardContent } = useContext(SongCardContext);
 *
 *   const song = // ... song data
 *
 *   const handleOpenCard = () => {
 *     getSongCardContent(song);
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleOpenCard}>Open Song Card</button>
 *     </div>
 *   );
 * }
 */

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
                        <ModalClose 
                            variant="solid"
                            onClick={() =>{
                                setSongCardOpen(false);
                                setSongCardContent(undefined);
                            }}
                        />
                        <Box
                            sx = {{
                                position: 'absolute',
                                bottom: -10,
                                left: 40,
                                right: 'auto',
                                transform: 'scale(1.8)',
                            }}
                        >
                        {(songCardContent != undefined) && (<ArtistAvatar
                            artist={songCardContent.artist}
                            format={songCardContent.format}
                            entry={songCardContent.release_number}
                        />)}
                        </Box>
                    </CardOverflow>
                    <CardContent sx = {{ pt: 3 }}>
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
                        6.3k plays
                        </Typography>
                        <Divider orientation="vertical" />
                        <Typography level="body3" sx={{ fontWeight: 'md', color: 'text.secondary' }}>
                        Added in 2003
                        </Typography>
                    </CardOverflow>
                </Card>
            </Modal>
            {children}
        </SongCardContext.Provider>
    )
}

export { SongCardProvider, SongCardContext };
