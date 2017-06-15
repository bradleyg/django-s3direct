import constants from '../constants';
import {request, parseJson, error, getCookie} from '../utils';

export const getUploadURL = (file, dest, url, store) => {


    console.log('ACTION getUploadURL', file, dest, url);

    const form  = new FormData(),
        headers = {'X-CSRFToken': getCookie('csrftoken')};

    form.append('type', file.type)
    form.append('name', file.name)
    form.append('dest', dest)

    console.log(form);

    // AJAX SHIT HAPPENS HERE YO
    request('POST', url, form, headers, false, function(status, json){
        const data = parseJson(json)

        console.log(status, data);

        switch(status) {
            case 200:
                store.dispatch(receiveAWSUploadParams(data.aws_payload));
                // upload(file, data.aws_payload, el)
                break
            case 400:
            case 403:
                // error(el, data.error)
                break;
            default:
                // error(el, i18n_strings.no_upload_url)
        }
    })

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