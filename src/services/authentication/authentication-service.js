import AWS, { CognitoIdentityServiceProvider } from 'aws-sdk';
import { toast } from 'sonner';
import jwtDecode from 'jwt-decode';


export const AWS_REGION = 'us-east-2';
export const AWS_USER_POOL_ID = 'us-east-2_ilnKaF5KQ';
export const AWS_CLIENT_ID = '5k75jn39vgdfavhun058t8m2te';
export const AWS_IDENTITY_POOL_ID = 'us-east-2:1438d416-cb03-4589-986d-e6e71f7d7b39'
export const AWS_ROLE_ARN = 'arn:aws:iam::203767826763:role/station-management';

AWS.config.update({
    region: AWS_REGION
});

let persistedISP = null;

const nullResult = { userObject: null, resetPasswordRequired: false, isAuthenticated: false, isAdmin: false };

export const refreshCognitoCredentials = async (notify = false) => {
    let idToken = localStorage.getItem('idToken');
    let cognitoISP = null;
    const credentialManager = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: AWS_IDENTITY_POOL_ID,
        Logins: {
            [`cognito-idp.${AWS_REGION}.amazonaws.com/${AWS_USER_POOL_ID}`]: idToken
        }
    });

    return await new Promise((resolve, reject) => {
        credentialManager.refresh((error) => {
            if (error) reject(error);

            if (notify) toast.success("Admin Privilages Granted.");

            cognitoISP = new AWS.CognitoIdentityServiceProvider({ 
                apiVersion: '2016-04-18', 
                region: AWS_REGION,
                credentials: credentialManager
            });

            resolve(cognitoISP);
        });
    });
}

export const login = async (event) => {
    const username = event.target.username.value;
    const password = event.target.password.value;

    const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: AWS_CLIENT_ID,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password
        }
    };

    AWS.config.update({
        region: AWS_REGION
    });

    const creatorISP = new AWS.CognitoIdentityServiceProvider({
        apiVersion: '2016-04-18',
        region: AWS_REGION
    });

    return new Promise((resolve, reject) => {
        creatorISP.initiateAuth(params, function (err, data) {
            if (err) return resolve(handleError(err));

            if (data.ChallengeName == 'NEW_PASSWORD_REQUIRED') {
                persistedISP = creatorISP;
                return resolve({
                    userObject: null,
                    resetPasswordRequired: true,
                    isAuthenticated: false,
                    isAdmin: false,
                });
            }

            localStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
            localStorage.setItem('idToken', data.AuthenticationResult.IdToken);
            localStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);

            const userParams = {
                AccessToken: data.AuthenticationResult.AccessToken
            };

            let adminTest = jwtDecode(data.AuthenticationResult.IdToken)['cognito:groups']?.includes('station-management');

            creatorISP.getUser(userParams, function (err, userData) {
                if (err) return resolve(handleError(err));

                toast.success('Logged in!');
                resolve({
                    userObject: userData,
                    resetPasswordRequired: false,
                    isAuthenticated: true,
                    isAdmin: adminTest
                });
            });
        });
    });
};

export const logout = async () => {
    localStorage.clear();
    return nullResult;
};

export const globalLogout = async (auth) => {
    const cognitoISP = refreshCognitoCredentials();
    return cognitoISP.globalSignOut({
        AccessToken: auth.AuthenticationResult.AccessToken
    }, function (err, data) {
        if (err) return handleError(err);

        return logout();       
    });
};

export const checkAuth = async () => {
    const accessToken = localStorage.getItem('accessToken');
    const idToken = localStorage.getItem('idToken');
    const refreshToken = localStorage.getItem('refreshToken');

    if (!accessToken || !idToken || !refreshToken) {
        return nullResult;
    }

    const params = {
        AccessToken: accessToken
    };

    const creatorISP = new AWS.CognitoIdentityServiceProvider({
        apiVersion: '2016-04-18',
        region: AWS_REGION
    });

    return new Promise((resolve, reject) => {
        creatorISP.getUser(params, function (err, userData) {
            if (err == 'Access Token has expired') {
                return refreshYourToken(checkAuth);
            }

            if (err) resolve(handleError(err));

            let adminTest = jwtDecode(idToken)['cognito:groups']?.includes('station-management');

            resolve({
                userObject: userData,
                resetPasswordRequired: false,
                isAuthenticated: true,
                isAdmin: adminTest
            });
        });
    });
};

export const refreshYourToken = async (callback) => {
    

};

export const updateInformation = async (event) => {
    event.preventDefault();

    let cognitoISP = persistedISP;
    
    return new Promise((resolve, reject) => {
        
    });
}

export const handleError = (err) => {
    toast.error(err.message || JSON.stringify(err));
    return nullResult;
}
