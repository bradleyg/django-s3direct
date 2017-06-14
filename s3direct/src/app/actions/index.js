import constants from '../constants';

export const getUploadURL = () => {
    return {
        type: constants.REQUEST_AWS_UPLOAD_PARAMS,
    }
}

export const receiveAWSUploadParams = () => {
    return {
        type: constants.RECEIVE_AWS_UPLOAD_PARAMS,
    }
}

export const didNotReceivAWSUploadParams = () => {
    return {
        type: constants.DID_NOT_RECEIVE_AWS_UPLOAD_PARAMS,
    }
}

export const removeUpload = () => {
    return {
        type: constants.REMOVE_UPLOAD
    }
}