import React from "react"
import { Card, CardOverflow, AspectRatio, Typography, Divider } from "@mui/joy"

const NowPlaying = (props) => {

    return (
    <Card
    variant='outlined'
    sx = {{
      width: props.width ?? '100%',
    }}
  >
    <CardOverflow>
      <AspectRatio ratio={props.aspect ?? 1.5}>

      </AspectRatio>
    </CardOverflow>
      <Typography level="body1" sx={{ fontSize: 'md', mt: 2 }}>
        Relax
      </Typography>
      <Typography level="body2" sx={{ mt: 0.5, mb: 2 }}>
        Frankie Goes to Hollywood
      </Typography>
      <Divider />
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
          DJ Turncoat
        </Typography>
        <Divider orientation="vertical" />
        <Typography level="body3" sx={{ fontWeight: 'md', color: 'text.secondary' }}>
          6.3k listening
        </Typography>
      </CardOverflow>
  </Card>
  )
}

export default NowPlaying
