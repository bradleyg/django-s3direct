
import { combineReducers } from 'redux'
import AWSUploadParams from './aws-upload-params'


const s3uploadApp = combineReducers({
  AWSUploadParams,
    // TODO - add more reducers
})

export default s3uploadApp