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
     * Albums pinned to the rightbar rail, in pin order. Session-scoped:
     * survives navigation and album changes, not reloads. Which card is open
     * is owned by the URL, never mirrored here.
     */
    pinnedAlbumIds: number[];
    /**
     * One shared collapse state for the docked panel beside the rail:
     * collapsing any pane collapses the dock, and reopening a different pane
     * from the collapsed state animates while pane-to-pane switches don't.
     * Meaningless when nothing is pinned.
     */
    dockView: DockView;
    /**
     * Which pinned album the album pane shows. Owned here, not by the URL —
     * opening an unpinned album's modal must not evict the docked card.
     */
    dockAlbumId: number | null;
}

export type DockView = "collapsed" | "home" | "album";

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
