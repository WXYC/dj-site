import { Divider, useTheme } from '@mui/joy';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale,
    BarElement,
    Title,
    Legend
} from 'chart.js';
import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Legend
);


const options = {
    responsive: true,
    barPercentage: 1.2,
    indexAxis: 'y',
    plugins: {
        legend: {
            // custom callback
            display: false,
        },
        title: {
            display: true,
            text: 'Rotation Plays (All Time)',
        },
    },
  };

  const optionsWeekly = {
    ...options,
    plugins: {
        legend: {
            // custom callback
            display: false,
        },
        title: {
            display: true,
            text: 'Rotation Plays (This Week)',
        },
    },
  }

export const RotationPlays = (props) => {

    const { palette } = useTheme();

    const rotationColors = {
        'H': palette.primary[600],
        'M': palette.info[600],
        'L': palette.success[600],
        'S': palette.warning[600]
    };

    const [albums, setAlbums] = useState([]);
    const [albumPlays, setAlbumPlays] = useState(null);
    const [albumPlaysThisWeek, setAlbumPlaysThisWeek] = useState(null);

    useEffect(() => {
        if (!props.backendData) return;

        let album_set = props.backendData.map((item) => item.album_title);
        setAlbums(album_set);

        setAlbumPlays({
            labels: album_set,
            datasets: [{
                label: 'All Data',
                data: props.backendData.map((dp) => dp.plays),
                backgroundColor: props.backendData.map((dp) => rotationColors[dp.play_freq]),
                borderRadius: 10
            }]
        });

        setAlbumPlaysThisWeek({
            labels: album_set,
            datasets: [{
                label: 'This Week',
                data: props.backendData.map((dp) => dp.plays_this_week),
                backgroundColor: props.backendData.map((dp) => rotationColors[dp.play_freq]),
                borderRadius: 10
            }]
        });

    }, [props.backendData, palette.colorScheme]);

    return (
        <div>
            {albumPlays && options && (<Bar options={options} data={albumPlays} />)}
            <Divider sx={{ my: 2 }} />
            {albumPlaysThisWeek && options && (<Bar options={optionsWeekly} data={albumPlaysThisWeek} />)}
        </div>
    );
}