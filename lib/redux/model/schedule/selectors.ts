import type { ReduxState } from "@/lib/redux";

export const getSchedule = (state: ReduxState) => state.schedule.events;