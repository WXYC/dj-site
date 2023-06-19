import React from 'react';
import AspectRatio from '@mui/joy/AspectRatio';
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import Typography from '@mui/joy/Typography';
import Sheet from '@mui/joy/Sheet';
import { Chip, Stack } from '@mui/joy';

const CallingCard = () => {

    const [live, setLive] = React.useState(false);

    return (
    <Box
        component="div"
        sx={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
    >
        <Card
          orientation="horizontal"
          sx={{
            width: '100%',
            flexWrap: 'wrap',
            [`& > *`]: {
              '--stack-point': '500px',
              minWidth:
                'clamp(0px, (calc(var(--stack-point) - 2 * var(--Card-padding) - 2 * var(--variant-borderWidth, 0px)) + 1px - 100%) * 999, 100%)',
            }
          }}
        >
          <CardContent>
            <Stack direction="row" spacing={1}>
                <Typography fontSize="xl" fontWeight="lg">
                Jackson Meade
                </Typography>
                <Box
                    sx = {{
                    display: 'flex',
                    alignItems: 'center',
                    }}
                >
                    <Typography level='body5'
                    sx = {{
                        height: '1.5em',
                    }}
                    >
                    aka
                    </Typography>
                </Box>
                <Typography fontSize="xl" fontWeight="lg" color="primary">
                    DJ Turncoat
                </Typography>
            </Stack>
            <Chip
                variant='outlined'
                color={live ? 'primary' : 'neutral'}
                size="sm"
                startDecorator={(live) ? '•' : '◦'}
            >
                {(live) ? 'Live Now' : '2 Hours Until Live'}
            </Chip>
            <Sheet
              sx={{
                bgcolor: 'background.level1',
                borderRadius: 'sm',
                p: 1.5,
                my: 1.5,
                display: 'flex',
                gap: 0.5,
                justifyContent: 'space-between',
                textAlign: 'center',
              }}
            >
              <div>
                <Typography fontWeight="lg">34</Typography>
                <Typography level="body3" fontWeight="lg">
                  Shows
                </Typography>
              </div>
              <div>
                <Typography fontWeight="lg">Weyes Blood</Typography>
                <Typography level="body3" fontWeight="lg">
                  Favorite Artist
                </Typography>
              </div>
              <div>
                <Typography fontWeight="lg">0</Typography>
                <Typography level="body3" fontWeight="lg">
                  Listeners
                </Typography>
              </div>
            </Sheet>
            <Box sx={{ display: 'flex', gap: 1.5, '& > button': { flex: 1 } }}>
              <Button variant="outlined" color="neutral">
                See Profile
              </Button>
              <Button variant="solid" color="primary">
                Follow
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    )
}

export default CallingCard;