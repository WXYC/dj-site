import { toast } from 'sonner';
import { Album, Song } from '../../redux/model/types';
import { deleter, getter, setter, updater } from "../api-service";
import { FSEntry } from './backend-types';
import { convertFlowsheetResult, convertGeneralToSpecificEntry } from './conversions';
import { FlowSheetEntry, FlowSheetEntryProps } from '@/lib/redux';

export const getNowPlayingFromBackend = () => getter('flowsheet/latest')();

export const getOnAirFromBackend = (djId: number) => {
    return getter(`flowsheet/on-air?dj_id=${djId}`)();
};

export const getDJListFromBackend = () => getter('flowsheet/djs-on-air')();

export const getFlowsheetFromBackend = (page = 0, limit = 50) => getter(`flowsheet?limit=${limit}&page=${page}`)();

export const retrieveFlowsheet = async (page = 0, limit = 50): Promise<FlowSheetEntry[]> => {

    const { data, error } = await getFlowsheetFromBackend(page, limit);

    if (error) {
        toast.error(error.message);
        return [];
    };

    return data?.map((item: FSEntry) => convertFlowsheetResult(item)) ?? [];
};

export const joinBackend = (djId: number, show_name = '', specialty_id: number | undefined = undefined) => setter('flowsheet/join')({
    dj_id: djId,
    show_name,
    specialty_id
});

export const leaveBackend = (djId: number) => setter('flowsheet/end')({
    dj_id: djId
});

export const sendMessageToBackend = (message: string) => setter('flowsheet')({
    message: message
});

export const addToFlowsheetBackend = (entry: FlowSheetEntryProps) => 
    setter('flowsheet')(convertGeneralToSpecificEntry(entry));

export const removeFromFlowsheetBackend = (id: number) => deleter(`flowsheet`)({
    entry_id: id,
});

/*
export const updateFlowsheetEntryOnBackend = (id: number, quality, value) => updater(`flowsheet`)({
    entry_id: id,
    [quality]: value,
});
*/