import AWS from 'aws-sdk';
import { toast } from 'sonner';

export const listUsers = async () => {
    AWS.config.credentials.get(function () {
        console.log(AWS.config.credentials.secretAccessKey);
    });
}