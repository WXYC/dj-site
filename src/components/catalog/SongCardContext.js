import React, { createContext, useState } from 'react';
import Modal from '@mui/joy/Modal';
import { Card, CardOverflow, AspectRatio, Typography, Divider, ModalClose } from '@mui/joy';

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

    const [songCardContent, setSongCardContent] = useState({});
    const [songCardOpen, setSongCardOpen] = useState(false);

    const getSongCardContent = (song) => {
        setSongCardOpen(true);
    }

    const contextValue = {
        getSongCardContent,
    }

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
                            <img src='./img/wxyc_board.png' />
                        </AspectRatio>
                        <ModalClose 
                            variant="solid"
                            onClick={() =>{
                                setSongCardOpen(false);
                                setSongCardContent({});
                            }}
                        />
                    </CardOverflow>

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
                        6.3k views
                        </Typography>
                        <Divider orientation="vertical" />
                        <Typography level="body3" sx={{ fontWeight: 'md', color: 'text.secondary' }}>
                        1 hour ago
                        </Typography>
                    </CardOverflow>
                </Card>
            </Modal>
            {children}
        </SongCardContext.Provider>
    )
}

export { SongCardProvider, SongCardContext };
