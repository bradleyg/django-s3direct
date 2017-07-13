export function getFilename (store) {
    return store.getState().appStatus.filename;
}

export function getUrl (store) {
    const url = store.getState().appStatus.signedURL || store.getState().appStatus.url;

    return url;
}

export function getError (store) {
    return store.getState().appStatus.error;
}

export function getUploadProgress (store) {
    return store.getState().appStatus.uploadProgress;
}

export function getElement (store) {
    return store.getState().element;
}

export function getAWSPayload (store) {
    return store.getState().AWSUploadParams.AWSPayload;
}