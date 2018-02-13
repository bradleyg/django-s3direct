import constants from '../constants';
import {i18n_strings} from '../constants';
import {request, parseJson, getCookie, parseURL, parseNameFromUrl, raiseEvent} from '../utils';
import {getElement, getAWSPayload} from '../store';

export const getUploadURL = (file, dest, url, store) => {

    const form  = new FormData(),
        headers = {'X-CSRFToken': getCookie('csrftoken')};

    form.append('type', file.type);
    form.append('name', file.name);
    form.append('dest', dest);

    const onLoad = function(status, json) {
        const data = parseJson(json);

        switch(status) {
            case 200:
                store.dispatch(receiveSignedURL(data.private_access_url));
                store.dispatch(receiveAWSUploadParams(data.aws_payload));
                store.dispatch(beginUploadToAWS(file, store));
                break;
            case 400:
            case 403:
            case 415:
                console.error('Error uploading', status, data.error);
                raiseEvent(getElement(store), 's3upload:error', {status, error: data});
                store.dispatch(addError(data.error));
                store.dispatch(didNotReceivAWSUploadParams());
                break;
            default:
                console.error('Error uploading', status, i18n_strings.no_upload_url);
                raiseEvent(getElement(store), 's3upload:error', {status, error: data});
                store.dispatch(addError(i18n_strings.no_upload_url));
                store.dispatch(didNotReceivAWSUploadParams());
        }
    }

    const onError = function(status, json) {
        const data = parseJson(json);

        console.error('Error uploading', status, i18n_strings.no_upload_url);
        raiseEvent(getElement(store), 's3upload:error', {status, error: data});

        store.dispatch(addError(i18n_strings.no_upload_url));
    }

    request('POST', url, form, headers, false, onLoad, onError);

    return {
        type: constants.REQUEST_AWS_UPLOAD_PARAMS
    }
}

export const receiveAWSUploadParams = (aws_payload) => {
    return {
        type: constants.RECEIVE_AWS_UPLOAD_PARAMS,
        aws_payload: aws_payload
    }
}

export const receiveSignedURL = (signedURL) => {
    return {
        type: constants.RECEIVE_SIGNED_URL,
        signedURL,
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

export const beginUploadToAWS = (file, store) => {
    const AWSPayload = getAWSPayload(store),
        url = AWSPayload.form_action,
        headers = {};

    let form = new FormData();

    // we need to remove this key because otherwise S3 will trigger a 403
    // when we send the payload along with the file.
    delete AWSPayload['form_action'];

    Object.keys(AWSPayload).forEach(function(key){
        form.append(key, AWSPayload[key]);
    });

    // the file has to be appended at the end, or else S3 will throw a wobbly
    form.append('file', file);

    const onLoad = function(status, xml) {
        switch(status) {
            case 201:
                const url = parseURL(xml),
                    filename = parseNameFromUrl(url).split('/').pop();

                store.dispatch(completeUploadToAWS(filename, url));
                raiseEvent(getElement(store), 's3upload:file-uploaded', {filename, url});
                break;
            default:
                console.error('Error uploading', status, xml);
                raiseEvent(getElement(store), 's3upload:error', {status, error: xml});

                store.dispatch(didNotCompleteUploadToAWS());

                if (xml.indexOf('<MinSizeAllowed>') > -1) {
                    store.dispatch(addError(i18n_strings.no_file_too_small));
                }
                else if (xml.indexOf('<MaxSizeAllowed>') > -1) {
                    store.dispatch(addError(i18n_strings.no_file_too_large));
                }
                else {
                    store.dispatch(addError(i18n_strings.no_upload_failed));
                }

                break;
        }
    };

    const onError = function(status, xml) {
        console.error('Error uploading', status, xml);
        raiseEvent(getElement(store), 's3upload:error', {status, xml});

        store.dispatch(didNotCompleteUploadToAWS());
        store.dispatch(addError(i18n_strings.no_upload_failed));
    }

    const onProgress = function(data) {
        let progress = null;

        if (data.lengthComputable) {
            progress = Math.round(data.loaded * 100 / data.total);
        }

        store.dispatch(updateProgress(progress));
        raiseEvent(getElement(store), 's3upload:progress-updated', {progress});
    }

    request('POST', url, form, headers, onProgress, onLoad, onError);

    return {
        type: constants.BEGIN_UPLOAD_TO_AWS
    }
}

export const completeUploadToAWS = (filename, url) => {
    return {
        type: constants.COMPLETE_UPLOAD_TO_AWS,
        url,
        filename
    }
}

export const didNotCompleteUploadToAWS = () => {
    return {
        type: constants.DID_NOT_COMPLETE_UPLOAD_TO_AWS
    }
}

export const addError = (error) => {
    return {
        type: constants.ADD_ERROR,
        error
    }
}

export const clearErrors = () => {
    return {
        type: constants.CLEAR_ERRORS
    }
}

export const updateProgress = (progress = {}) => {
    return {
        type: constants.UPDATE_PROGRESS,
        progress
    }
}
