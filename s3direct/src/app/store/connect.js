export function getFilename (store) {
    return store.getState().appStatus.filename;
}

export function getUrl (store) {
    return store.getState().appStatus.url;
}

export function getError (store) {
    return store.getState().appStatus.error;
}

export function getUploadProgress (store) {
    return store.getState().appStatus.uploadProgress;
}