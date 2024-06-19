

interface UserFormElements extends HTMLFormControlsCollection {
    username: HTMLInputElement;
    tempPassword: HTMLInputElement;
    email: HTMLInputElement;
}

interface AddDJFormElements extends UserFormElements { 
    password: HTMLInputElement;
}

interface AddDJsFormElements extends HTMLFormControlsCollection {
    usernamesandemails: HTMLInputElement;
    password: HTMLInputElement;
}

interface ResetPasswordFormElements extends UserFormElements { }
