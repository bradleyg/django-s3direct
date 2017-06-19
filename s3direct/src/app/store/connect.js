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