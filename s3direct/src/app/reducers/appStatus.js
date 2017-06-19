import constants from '../constants';

export default (state = {}, action) => {
    switch (action.type) {
        case constants.BEGIN_UPLOAD_TO_AWS:
            return Object.assign({}, state, {
                isUploading: true
            });
        case constants.COMPLETE_UPLOAD_TO_AWS:
            return Object.assign({}, state, {
                isUploading: false,
                filename: action.filename,
                url: action.url
            });
        case constants.REMOVE_UPLOAD:
            return Object.assign({}, state, {
                filename: null,
                url: null
            });
        case constants.ADD_ERROR:
            return Object.assign({}, state, {
                error: action.error
            });
        case constants.CLEAR_ERRORS:
            return Object.assign({}, state, {
                error: null
            });
        case constants.UPDATE_PROGRESS:
            let progress = null;

            if (action.data.lengthComputable) {
                progress = Math.round(action.data.loaded * 100 / action.data.total);
            }

            return Object.assign({}, state, {
                uploadProgress: progress
            });
        case constants.RECEIVE_SIGNED_URL: {
            return Object.assign({}, state, {
                signedURL: action.signedURL
            });
        }

        default:
            return state;
    }
}