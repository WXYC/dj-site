import React, { createContext, useState } from 'react';
import Modal from '@mui/joy/Modal';
import { Card, CardOverflow, AspectRatio, Typography, Divider, ModalClose } from '@mui/joy';

const SongCardContext = createContext();

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
