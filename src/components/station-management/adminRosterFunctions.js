import AWS, { CognitoIdentityCredentials } from 'aws-sdk';
import { Auth } from 'aws-amplify';

import { toast } from 'sonner';

const USERPOOLID = 'us-east-2_ilnKaF5KQ';

/* const adminCreateUser = async (username, password) => {
    const cognitoParams = {
        UserPoolId: USERPOOLID,
        Username: username,
        TemporaryPassword: password,
    }

    try {

        cognito.config.credentials = Auth.essentialCredentials(await Auth.currentCredentials());

        let response = await cognito.adminCreateUser(cognitoParams).promise();

        
    console.log(JSON.stringify(response, null, 2));
    } catch (error) {
        toast.error(error.toString());
    }
} */

const listUsers = async () => {
    try {

    var params = {
        UserPoolId: USERPOOLID,
        AttributesToGet: [
            'username',
        ],
    }

    const data = AWS.config.update({region: 'us-east-2'});
    var cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();
    cognitoIdentityServiceProvider.config.credentials = Auth.essentialCredentials(await Auth.currentCredentials());

    cognitoIdentityServiceProvider.listUsers(params, (err, data) => {
    });
    } catch (error) {
        toast.error(error.toString());
    }
}

export {
    //adminCreateUser,
    listUsers,
}