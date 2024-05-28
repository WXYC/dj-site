'use client';
import RotationSearchTable from "@/app/components/Rotation/RotationSearchTable";
import { Rotation, getRotation, rotationSlice, useDispatch, useSelector } from "@/lib/redux";
import { addToRotation, loadRotation } from "@/lib/redux/model/rotation/thunks";
import { RotationQueryParameters } from "@/lib/services/catalog/frontend-types";
import { Sheet } from "@mui/joy";
import { useEffect } from "react";

interface RotationQuery extends HTMLFormControlsCollection {
    album: HTMLInputElement;
    freq: HTMLInputElement;
}

const RotationPage = (): JSX.Element => {

    const dispatch = useDispatch();
    const rotationEntries = useSelector(getRotation);

    useEffect(() => {
        dispatch(loadRotation());
    }, []);

    const tempHandleAdd = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const { album, freq } = (event.target as HTMLFormElement).elements as RotationQuery;
        
        const album_id: number = parseInt(album.value);
        const play_freq: Rotation = freq.value as Rotation;

        dispatch(addToRotation({
            album_id,
            play_freq
        }));

        event.currentTarget.reset();
    }

    return (
        <Sheet
            sx = {{
                maxHeight: '100%',
                overflowY: 'auto',
                bgcolor: 'transparent',
            }}
        >
            <RotationSearchTable />

            <ul>
                <form onSubmit={tempHandleAdd}>
                    <input type="text" name="album" placeholder="Album ID" />
                    <input type="text" name="freq" placeholder="Play Frequency" />
                    <button>Submit</button>
                </form>
            </ul>
        </Sheet>
    );
}

export default RotationPage;