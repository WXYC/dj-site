import { Account } from "../admin/types";
import { ColorMode, ExperienceId } from "../experiences/types";

export const defaultApplicationState: ApplicationState = {
    experience: "modern",
    colorMode: "light",
    themeId: "default",
    rightBarMini: true,
};

export interface ApplicationState {
    experience: ExperienceId;
    colorMode: ColorMode;
    /** Active modern theme id (see lib/features/experiences/modern/themes). */
    themeId: string;
    rightBarMini: boolean;
}

export interface ApplicationFrontendState {
    rightbar: RightbarState;
    authFlow: AuthFlowState;
    /**
     * The route-driven album card docks to the right edge instead of centering
     * when pinned. Session-scoped: survives album changes, not reloads.
     */
    albumCardPinned: boolean;
}

export interface RightbarState {
    sidebarOpen: boolean;
    panel: RightbarPanel;
}

// Adding a stage here does NOT make it a persistable login preference:
// `login-method-storage.ts`'s `PreferredLoginMethod` uses an explicit
// `Extract<AuthStage, ...>` allow-list, so state-only stages (`otp-verify`,
// `forgot`, `reset`) stay out of what gets written to localStorage.
export type AuthStage = "otp-email" | "otp-verify" | "password" | "forgot" | "reset" | "qr";

export interface AuthFlowState {
    stage: AuthStage;
}

export type RightbarPanel =
    | { type: "default" }
    | { type: "settings" }
    | { type: "account-edit"; account: Account; isSelf: boolean; organizationSlug: string };
