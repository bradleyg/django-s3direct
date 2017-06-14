import React from 'react';
import ReactDOM from 'react-dom';
import S3Upload from './App';
import registerServiceWorker from './registerServiceWorker';

ReactDOM.render(<S3Upload />, document.getElementById('root'));
registerServiceWorker();
