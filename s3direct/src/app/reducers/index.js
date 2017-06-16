import { combineReducers } from 'redux';
import AWSUploadParams from './awsUploadsParams';
import appStatus from './appStatus';


export default combineReducers({
  AWSUploadParams,
  appStatus
    // TODO - add more reducers
});