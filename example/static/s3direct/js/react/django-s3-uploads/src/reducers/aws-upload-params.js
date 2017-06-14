export const reports = (state = reportsInitial, action) => {
    switch (action.type) {
        case types.REQUEST_AWS_UPLOAD_PARAMS:
            return Object.assign({}, state, {
                isLoading: true
            });
        case types.RECEIVE_AWS_UPLOAD_PARAMS:
            return Object.assign({}, state, {
                isLoading: false,
                items: action.reports
                //widths: getReportItemWidths(action.reports)
            });
            return reportState;
        case types.DID_NOT_RECEIVE_AWS_UPLOAD_PARAMS:
            // Returns current state and sets loading to false
            return Object.assign({}, state, {
                isLoading: false
            });
        default:
        return state; // reducer must return by default
    }
}