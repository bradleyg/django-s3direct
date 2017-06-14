import constants from '../constants';

export default (state = reportsInitial, action) => {
    switch (action.type) {
        case constants.REQUEST_AWS_UPLOAD_PARAMS:
            return Object.assign({}, state, {
                isLoading: true
            });
        case constants.RECEIVE_AWS_UPLOAD_PARAMS:
            return Object.assign({}, state, {
                isLoading: false,
                items: action.reports
                //widths: getReportItemWidths(action.reports)
            });
            return reportState;
        case constants.DID_NOT_RECEIVE_AWS_UPLOAD_PARAMS:
            // Returns current state and sets loading to false
            return Object.assign({}, state, {
                isLoading: false
            });
        default:
        return state; // reducer must return by default
    }
}