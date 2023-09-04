import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import { Box, Button, ButtonGroup, Chip, CircularProgress, Divider, IconButton, Sheet, Stack, Table, Tooltip, Typography, useTheme } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { addAlbumToRotation, getRotationEntries, removeFromRotationBackend } from "../../../../services/station-management/rotation-service";
import { AddToRotationSearch } from "./AddToRotationSearch";
import { RotationPlays } from "./RotationPlays";

import AbcIcon from '@mui/icons-material/Abc';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SummarizeIcon from '@mui/icons-material/Summarize';

const rotationStyles = {
    'H': 'primary',
    'M': 'info',
    'L': 'success',
    'S': 'warning',
};

const rotationCodes = ['H', 'M', 'L', 'S'];

const rotationLabels = {
  H: "Heavy",
  M: "Medium",
  L: "Light",
  S: "Singles",
};

const algorithms = {
    alphabetical: (a, b) => a.album_title.localeCompare(b.album_title),
    rotation: (a, b) => rotationCodes.indexOf(b.play_freq) - rotationCodes.indexOf(a.play_freq),
    plays: (a, b) => a.plays - b.plays
}

export const RotationManagement = () => {

    const { palette } = useTheme();

    const [backendData, setBackendData] = useState(null);
    
    const [sortType, setSortType] = useState('alphabetical');

    const [removalWork, setRemovalWork] = useState([]);
    const deleteFromRotation = async (id) => {
        setRemovalWork([...removalWork, id]);

        const { data, error } = await removeFromRotationBackend(id);

        if (error) {
            toast.error("Failed to remove album from rotation.");
            console.error(error);
        }

        if (data) {
            toast.success("Successfully removed album from rotation.");
        }

        setRemovalWork(removalWork.filter((item) => item !== id));
    };

    useEffect(() => {
        if (removalWork.length > 0) return;
        (async () => {
                const { data, error } = await getRotationEntries();

                if (error) {
                    toast.error("We could not retrieve your rotation plays...");
                    console.error(error);
                }

                setBackendData(data.filter((item) => item.kill_date === null));
        })();
    }, [removalWork]);

    useEffect(() => {
        if (!backendData) return;

        setBackendData([...backendData].sort(algorithms[sortType]));
    }, [sortType]);

    return (
        <>
        
        <Box
                sx = {{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    left: 0,
                    p: 1,
                    zIndex: 1,
                    borderBottomRightRadius: 15,
                    borderBottomLeftRadius: 15,
                    backgroundColor: palette.info.softBg,
                }}
            >
            <Stack direction="row" alignItems="center" justifyContent={'space-between'}>
            <Button
                variant='outlined'
                color='success'
                startDecorator={<SummarizeIcon />}
            >
                Download Report
            </Button>
            <Stack direction="row" spacing={0} alignItems="center" justifyContent={'flex-end'}>
            <ButtonGroup>
                <Tooltip variant="outlined" placement='top' size="sm" title="Alphabetically">
                <IconButton variant={sortType == 'alphabetical' ? 'solid' : 'outlined'} onClick={() => setSortType('alphabetical')}>
                    <AbcIcon />
                </IconButton>
                </Tooltip>
                <Tooltip variant="outlined" placement='top' size="sm" title="By Rotation Type">
                <IconButton variant={sortType == 'rotation' ? 'solid' : 'outlined'} onClick={() => setSortType('rotation')}>
                    <AutoModeIcon />
                </IconButton>
                </Tooltip>
                <Tooltip variant="outlined" placement='top' size="sm" title="By Plays">
                <IconButton variant={sortType == 'plays' ? 'solid' : 'outlined'} onClick={() => setSortType('plays')}>
                    <PlayCircleIcon />
                </IconButton>
                </Tooltip>
            </ButtonGroup>
            <Typography level="body3" sx = {{ writingMode: 'tb-rl', textOrientation: 'sideways-right' }}>SORT</Typography>
            </Stack>
            </Stack>
            </Box>
        <Sheet
            sx = {{
                p: 3,
                overflow: 'auto',
                maxHeight: "calc(100vh - 220px)",
                borderRadius: 15,
                position:'relative',
                pb: '56px' // adjust for the bottom bar
            }}
        >
            <Box
                sx = {{
                    maxHeight: '500px',
                    overflowY: 'auto',
                }}
            >
            <Table stripe="odd">
                <tbody>
                    {backendData?.map((item, idx) => (
                        <tr key={`${item.artist_name}-${item.album_title}-${item.play_freq}-${idx}`}>
                            <td>
                                <Typography variant = 'h6'>{item.artist_name}</Typography>
                            </td>
                            <td>
                                <Typography variant = 'h6'>{item.album_title}</Typography>
                            </td>
                            <td>
                                <Typography variant = 'h6'>{item.label_name}</Typography>
                            </td>
                            <td
                                style={{
                                    width: '50px',
                                }}
                            >
                                <Chip color = {rotationStyles[item.play_freq]} size="sm">
                                    {item.play_freq}
                                </Chip>
                            </td>
                            <td>
                                <Stack direction="row" spacing={0.3} justifyContent={'flex-end'}>
                                <IconButton
                                    size="sm"
                                    variant="solid"
                                    color="success"
                                >
                                    <EditIcon />
                                </IconButton>
                                <IconButton
                                    size="sm"
                                    variant="solid"
                                    color="info"
                                >
                                    <InfoIcon />
                                </IconButton>
                                <IconButton
                                    size="sm"
                                    variant="solid"
                                    onClick={() => deleteFromRotation(item.rotation_id)}
                                    disabled={removalWork.includes(item.rotation_id)}
                                >
                                    <ClearIcon />
                                </IconButton>
                                </Stack>
                            </td>
                        </tr>
                    )) ?? <CircularProgress />}
                </tbody>
            </Table>
            </Box>
            <AddToRotationSearch />
            <Divider sx = {{ my: 3 }} />
            <RotationPlays backendData={backendData} />
        </Sheet>
        </>
    );
}