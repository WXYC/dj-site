import { JwtPayload } from "jwt-decode";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthenticationState {
  authenticating: boolean;
  isAuthenticated: boolean;
  user?: User | AuthenticatingUser;
}

export interface User {
  username: string;
  djName: string;
  djId: number;
  name: string;
  isAdmin: boolean;
  showRealName: boolean;
  funFact?: FunFact;
}

export interface AuthenticatingUser {
  username: string;
  resetPassword: boolean;
  session?: string;
}

export interface FunFact {
  fact: string;
  type: "artist" | "song" | "album";
}

export interface DJwtPayload extends JwtPayload {
  "cognito:groups"?: string[];
  "cognito:username"?: string;
}

// CONSTANTS
export const nullState: AuthenticationState = {
  authenticating: false,
  isAuthenticated: false,
  user: undefined,
};
