import { Account } from "../admin/types";
import { ColorMode, ExperienceId } from "../experiences/types";

export const defaultApplicationState: ApplicationState = {
    experience: "modern",
    colorMode: "light",
    rightBarMini: true,
};

export interface ApplicationState {
    experience: ExperienceId;
    colorMode: ColorMode;
    rightBarMini: boolean;
}

export interface ApplicationFrontendState {
    rightbar: RightbarState;
    authFlow: AuthFlowState;
}

export interface RightbarState {
    mini: boolean;
    sidebarOpen: boolean;
    panel: RightbarPanel;
}

export type AuthStage = "otp-email" | "otp-verify" | "password" | "forgot" | "reset";

export interface AuthFlowState {
    stage: AuthStage;
}

export type RightbarPanel =
    | { type: "default" }
    | { type: "album-detail"; albumId: number }
    | { type: "settings" }
    | { type: "account-edit"; account: Account; isSelf: boolean; organizationSlug: string };
