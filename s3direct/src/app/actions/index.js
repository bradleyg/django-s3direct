import constants from '../constants';
import {i18n_strings} from '../constants';
import {request, parseJson, error, getCookie, parseURL, parseNameFromUrl} from '../utils';

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
                store.dispatch(receiveAWSUploadParams(data.aws_payload));
                store.dispatch(beginUploadToAWS(file, store));
                break;
            case 400:
            case 403:
                console.error('Error uploading', status, data.error);
                store.dispatch(addError(data.error));
                break;
            default:
                console.error('Error uploading', status, i18n_strings.no_upload_url);
                store.dispatch(addError(i18n_strings.no_upload_url));
        }
    }

    const onError = function(status, json) {
        const data = parseJson(json);

        console.log('onError', data);
    }

    // AJAX SHIT HAPPENS HERE YO
    request('POST', url, form, headers, false, onLoad, onError);

    // return action type for logging an ting
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
    const AWSPayload = store.getState().AWSUploadParams.AWSPayload,
        url = AWSPayload.form_action,
        headers = {};

    let form = new FormData();

    delete AWSPayload['form_action'];

    Object.keys(AWSPayload).forEach(function(key){
        form.append(key, AWSPayload[key]);
    });

    form.append('file', file);

    const onLoad = function(status, xml) {
        switch(status) {
            case 201:
                const url = parseURL(xml),
                    filename = parseNameFromUrl(url).split('/').pop();

                store.dispatch(completeUploadToAWS(url, filename));

                break;
            default:
                console.error('Error uploading', status, xml);

                if (xml.indexOf('<MinSizeAllowed>') > -1) {
                    store.dispatch(addError(i18n_strings.no_file_too_small));
                }
                else if (xml.indexOf('<MaxSizeAllowed>') > -1) {
                    store.dispatch(addError(i18n_strings.no_file_too_large));
                }
                else {
                    store.dispatch(addError(i18n_strings.no_upload_url));
                }

                break;
        }
    };

    const onError = function(status, xml) {
        console.log('onError', xml);
    }

    request('POST', url, form, headers, false, onLoad, onError);

    return {
        type: constants.BEGIN_UPLOAD_TO_AWS
    }
}

export const completeUploadToAWS = (url, filename) => {
    return {
        type: constants.COMPLETE_UPLOAD_TO_AWS,
        url,
        filename
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