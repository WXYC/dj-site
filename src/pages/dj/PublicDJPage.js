import React, { useState, useEffect } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import { Card, Box, CardContent, CardHeader, CircularProgress, Sheet, Stack, Typography, Button, Link } from "@mui/joy";
import Logo from "../../components/branding/logo";
import CallingCard from "../../widgets/calling-card/CallingCard";

/**
 * Renders a page displaying a 'calling card' for DJs who elect to have that shared.
 * 
 * @page
 * @category DJs
 * 
 * @returns {JSX.Element} The rendered component.
 */
export const PublicDJPage = () => {

    let { djName } = useParams();

    const [foundDJ, setFoundDJ] = useState(true);

    return (
        <>
        <Sheet
            sx = {(theme) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                width: '100vw',     
                backdropFilter: 'blur(4px)',
                backgroundColor: 'rgba(255 255 255 / 0.5)',
                [theme.getColorSchemeSelector('dark')]: {
                    backgroundColor: 'rgba(19 19 24 / 0.7)',
                },
            })}
        >
            {foundDJ ? (
                <CallingCard
                    djName={djName}
                />
            ) : (
                    <Card
                        sx = {{
                            p: 9,
                        }}
                    >
                        <Box
                            sx = {(theme) => ({
                            height: '100px',
                            })}
                        >
                            <Logo />
                        </Box>
                        <Typography
                            level="h1"
                            sx = {{
                                fontSize: '4.5em',
                            }}
                        >
                            {djName} isn't a DJ
                        </Typography>
                        <Typography
                            level="body1"
                            color="primary"
                            sx = {{
                                textAlign: 'center',
                            }}
                        >
                            But they could be...
                        </Typography>
                            <Button
                                component="a"
                                target="_blank"
                                href="https://wxyc.org/contact-2/"
                                variant="solid"
                                color="primary"
                                sx = {{
                                    mt: 4,
                                    width: '100%',
                                    textDecoration: 'none !important',
                                }}
                                size="lg"
                            >
                                Learn How You Can Join Us
                            </Button>
                    </Card>
            )}
                  
      </Sheet>
        <Box
        sx={(theme) => ({
            zIndex: -1,
          height: '100%',
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          left: 0,
          transition:
            'background-image var(--Transition-duration), left var(--Transition-duration) !important',
          transitionDelay: 'calc(var(--Transition-duration) + 0.1s)',
          backgroundColor: 'background.level1',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundImage:
            'url("./img/wxyc_color.png")',
          [theme.getColorSchemeSelector('dark')]: {
            backgroundImage:
              'url("./img/wxyc_dark.jpg")',
          },
        })}
      />

        </>
    )
}