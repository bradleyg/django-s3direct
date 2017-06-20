import { combineReducers } from 'redux';
import AWSUploadParams from './awsUploadsParams';
import appStatus from './appStatus';

const element = (state = {}, action) => {
    return state; // reducer must return by default
}

export default combineReducers({
  AWSUploadParams,
  appStatus,
  element
});