import { getter } from "../api-service";

export const getNowPlayingFromBackend = () => getter("flowsheet/latest")();
