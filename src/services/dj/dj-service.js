import { getter } from "../api-service";


export const getDJInfo = (id) => id ? getter(`djs?dj_id=${id}`)() : { data: null, error: null };