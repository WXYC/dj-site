'use client';
import RotationSearchTable from "@/app/components/Rotation/RotationSearchTable";
import { Rotation, useDispatch } from "@/lib/redux";
import { addToRotation } from "@/lib/redux/model/rotation/thunks";
import { Sheet } from "@mui/joy";

interface RotationQuery extends HTMLFormControlsCollection {
    album: HTMLInputElement;
    freq: HTMLInputElement;
}

const CatalogManagementPage = (): JSX.Element => {

    const dispatch = useDispatch();

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
        </Sheet>
    );
}

export default CatalogManagementPage;