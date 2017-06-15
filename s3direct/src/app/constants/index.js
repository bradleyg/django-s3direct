export default {
    REQUEST_AWS_UPLOAD_PARAMS: 'REQUEST_AWS_UPLOAD_PARAMS',
    RECEIVE_AWS_UPLOAD_PARAMS: 'RECEIVE_AWS_UPLOAD_PARAMS',
    DID_NOT_RECEIVE_AWS_UPLOAD_PARAMS: 'DID_NOT_RECEIVE_AWS_UPLOAD_PARAMS',
    REMOVE_UPLOAD: 'REMOVE_UPLOAD'
};

let i18n_strings;

try {
    i18n_strings = djangoS3Upload.i18n_strings;
} catch(e) {
    i18n_strings = {
        "no_upload_failed": "Sorry, failed to upload file.",
        "no_upload_url": "Sorry, could not get upload URL.",
        "no_file_too_large": "Sorry, the file is too large to be uploaded.",
        "no_file_too_small": "Sorry, the file is too small to be uploaded."
    };
}

export {i18n_strings};