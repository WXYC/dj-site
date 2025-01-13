
export type User = {
  username: string;
  name?: string;
  djName?: string;
  email?: string;
  authority: Authority;
};

export enum Authority
{
    None,
    DJ, // Traditional DJ
    MD, // Music Director
    SM // Station Manager
};

export interface AuthenticationState {
    credentials: Credentials;
    validation: CredentialValidation;
    response: SigninResponse | undefined;
    pending: boolean;
    user: User | undefined;
  }
  
  export interface Credentials {
    username: string;
    password: string;
    realname?: string;
    djname?: string;
  }
  
  export type CredentialValidation = {
    [K in keyof Credentials | "compareTo"]: boolean;
  };
  
  export interface UpdateCredentialPayload {
    field: keyof Credentials | "compareTo";
    approved: boolean;
  }

  export type SigninResponse = {
    passwordChallenge: boolean;
    message?: string;
    user?: Credentials;
  } | undefined;