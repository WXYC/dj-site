import AWS from 'aws-sdk';
import { toast } from 'sonner';
import jwtDecode from 'jwt-decode';

export const AWS_REGION = 'us-east-2';
export const AWS_CLIENT_ID = '5k75jn39vgdfavhun058t8m2te';
export const AWS_USER_POOL_ID = 'us-east-2_ilnKaF5KQ';
export const AWS_IDENTITY_POOL_ID = 'us-east-2:8c147929-6028-4f53-8e1f-fe0a4c23d8fa';
export const AWS_ROLE_ARN = 'arn:aws:iam::203767826763:role/station-management';
export const cognitoISP = new AWS.CognitoIdentityServiceProvider({ apiVersion: '2016-04-18', region: AWS_REGION});

AWS.config.update({ region: AWS_REGION });

const nullResult = { userObject: {}, resetPasswordRequired: false, isAuthenticated: false, isAdmin: false };


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

    return new Promise((resolve, reject) => {
        cognitoISP.initiateAuth(params, function (err, data) {
            if (err) resolve(handleError(err));

            if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
                resolve({
                    userObject: null,
                    resetPasswordRequired: true,
                    isAuthenticated: false,
                    isAdmin: false
                });
            }

            localStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
            localStorage.setItem('idToken', data.AuthenticationResult.IdToken);
            localStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);

            const userParams = {
                AccessToken: data.AuthenticationResult.AccessToken
            };

            const credentialManager = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: AWS_IDENTITY_POOL_ID,
                RoleArn: AWS_ROLE_ARN,
                Logins: {
                    [`cognito-idp.${AWS_REGION}.amazonaws.com/${AWS_USER_POOL_ID}`]: data.AuthenticationResult.IdToken
                }
            });

            credentialManager.refresh((error) => {
                if (error) resolve(handleError(error));

                AWS.config.credentials = credentialManager;
            });

            cognitoISP.getUser(userParams, function (err, userData) {
                if (err) resolve(handleError(err));

                toast.success('Logged in!');
                resolve({
                    userObject: userData,
                    resetPasswordRequired: false,
                    isAuthenticated: true,
                    isAdmin: jwtDecode(data.AuthenticationResult.IdToken)['cognito:groups']?.includes('station-management')
                });
            });
        });
    });
};

export const logout = async () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
    return nullResult;
};

export const globalLogout = async (auth) => {
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

    return new Promise((resolve, reject) => {
        cognitoISP.getUser(params, function (err, userData) {
            if (err) resolve(handleError(err));

            resolve({
                userObject: userData,
                resetPasswordRequired: false,
                isAuthenticated: true,
                isAdmin: jwtDecode(idToken)['cognito:groups']?.includes('station-management')
            });
        });
    });
};

export const updatePassword = async (event, user_challenged) => {
    event.preventDefault();
    

}

const handleError = (error) => {
    // split after the first colon and get the second part
    let errorMessage = error.toString().split(': ')[1];
    toast.error(errorMessage);
    return nullResult;
}