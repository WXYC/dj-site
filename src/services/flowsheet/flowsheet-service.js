import { getter, setter } from "../api-service";

export const getNowPlayingFromBackend = () => getter('flowsheet/latest')();

export const getFlowsheetFromBackend = (page = 0, limit = 50) => getter('flowsheet')({
    page: page,
    limit: limit
});

export const joinBackend = (show_name = '', specialty_id = null) => setter('flowsheet/join')({
    dj_id: sessionStorage.getItem('djId'),
    show_name,
    specialty_id
});

export const leaveBackend = () => setter('flowsheet/leave')({
    dj_id: sessionStorage.getItem('djId')
});