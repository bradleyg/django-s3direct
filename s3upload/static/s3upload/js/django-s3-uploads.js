(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.updateProgress = exports.clearErrors = exports.addError = exports.didNotCompleteUploadToAWS = exports.completeUploadToAWS = exports.beginUploadToAWS = exports.removeUpload = exports.didNotReceivAWSUploadParams = exports.receiveSignedURL = exports.receiveAWSUploadParams = exports.getUploadURL = undefined;

var _constants = require('../constants');

var _constants2 = _interopRequireDefault(_constants);

var _utils = require('../utils');

var _store = require('../store');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var getUploadURL = exports.getUploadURL = function getUploadURL(file, dest, url, store) {

    var form = new FormData(),
        headers = { 'X-CSRFToken': (0, _utils.getCookie)('csrftoken') };

    form.append('type', file.type);
    form.append('name', file.name);
    form.append('dest', dest);

    var onLoad = function onLoad(status, json) {
        var data = (0, _utils.parseJson)(json);

        switch (status) {
            case 200:
                store.dispatch(receiveSignedURL(data.private_access_url));
                store.dispatch(receiveAWSUploadParams(data.aws_payload));
                store.dispatch(beginUploadToAWS(file, store));
                break;
            case 400:
            case 403:
            case 415:
                console.error('Error uploading', status, data.error);
                (0, _utils.raiseEvent)((0, _store.getElement)(store), 's3upload:error', { status: status, error: data });
                store.dispatch(addError(data.error));
                store.dispatch(didNotReceivAWSUploadParams());
                break;
            default:
                console.error('Error uploading', status, _constants.i18n_strings.no_upload_url);
                (0, _utils.raiseEvent)((0, _store.getElement)(store), 's3upload:error', { status: status, error: data });
                store.dispatch(addError(_constants.i18n_strings.no_upload_url));
                store.dispatch(didNotReceivAWSUploadParams());
        }
    };

    var onError = function onError(status, json) {
        var data = (0, _utils.parseJson)(json);

        console.error('Error uploading', status, _constants.i18n_strings.no_upload_url);
        (0, _utils.raiseEvent)((0, _store.getElement)(store), 's3upload:error', { status: status, error: data });

        store.dispatch(addError(_constants.i18n_strings.no_upload_url));
    };

    (0, _utils.request)('POST', url, form, headers, false, onLoad, onError);

    return {
        type: _constants2.default.REQUEST_AWS_UPLOAD_PARAMS
    };
};

var receiveAWSUploadParams = exports.receiveAWSUploadParams = function receiveAWSUploadParams(aws_payload) {
    return {
        type: _constants2.default.RECEIVE_AWS_UPLOAD_PARAMS,
        aws_payload: aws_payload
    };
};

var receiveSignedURL = exports.receiveSignedURL = function receiveSignedURL(signedURL) {
    return {
        type: _constants2.default.RECEIVE_SIGNED_URL,
        signedURL: signedURL
    };
};

var didNotReceivAWSUploadParams = exports.didNotReceivAWSUploadParams = function didNotReceivAWSUploadParams() {
    return {
        type: _constants2.default.DID_NOT_RECEIVE_AWS_UPLOAD_PARAMS
    };
};

var removeUpload = exports.removeUpload = function removeUpload() {
    return {
        type: _constants2.default.REMOVE_UPLOAD
    };
};

var beginUploadToAWS = exports.beginUploadToAWS = function beginUploadToAWS(file, store) {
    var AWSPayload = (0, _store.getAWSPayload)(store),
        url = AWSPayload.form_action,
        headers = {};

    var form = new FormData();

    // we need to remove this key because otherwise S3 will trigger a 403
    // when we send the payload along with the file.
    delete AWSPayload['form_action'];

    Object.keys(AWSPayload).forEach(function (key) {
        form.append(key, AWSPayload[key]);
    });

    // the file has to be appended at the end, or else S3 will throw a wobbly
    form.append('file', file);

    var onLoad = function onLoad(status, xml) {
        switch (status) {
            case 201:
                var _url = (0, _utils.parseURL)(xml),
                    filename = (0, _utils.parseNameFromUrl)(_url).split('/').pop();

                store.dispatch(completeUploadToAWS(filename, _url));
                (0, _utils.raiseEvent)((0, _store.getElement)(store), 's3upload:file-uploaded', { filename: filename, url: _url });
                break;
            default:
                console.error('Error uploading', status, xml);
                (0, _utils.raiseEvent)((0, _store.getElement)(store), 's3upload:error', { status: status, error: xml });

                store.dispatch(didNotCompleteUploadToAWS());

                if (xml.indexOf('<MinSizeAllowed>') > -1) {
                    store.dispatch(addError(_constants.i18n_strings.no_file_too_small));
                } else if (xml.indexOf('<MaxSizeAllowed>') > -1) {
                    store.dispatch(addError(_constants.i18n_strings.no_file_too_large));
                } else {
                    store.dispatch(addError(_constants.i18n_strings.no_upload_failed));
                }

                break;
        }
    };

    var onError = function onError(status, xml) {
        console.error('Error uploading', status, xml);
        (0, _utils.raiseEvent)((0, _store.getElement)(store), 's3upload:error', { status: status, xml: xml });

        store.dispatch(didNotCompleteUploadToAWS());
        store.dispatch(addError(_constants.i18n_strings.no_upload_failed));
    };

    var onProgress = function onProgress(data) {
        var progress = null;

        if (data.lengthComputable) {
            progress = Math.round(data.loaded * 100 / data.total);
        }

        store.dispatch(updateProgress(progress));
        (0, _utils.raiseEvent)((0, _store.getElement)(store), 's3upload:progress-updated', { progress: progress });
    };

    (0, _utils.request)('POST', url, form, headers, onProgress, onLoad, onError);

    return {
        type: _constants2.default.BEGIN_UPLOAD_TO_AWS
    };
};

var completeUploadToAWS = exports.completeUploadToAWS = function completeUploadToAWS(filename, url) {
    return {
        type: _constants2.default.COMPLETE_UPLOAD_TO_AWS,
        url: url,
        filename: filename
    };
};

var didNotCompleteUploadToAWS = exports.didNotCompleteUploadToAWS = function didNotCompleteUploadToAWS() {
    return {
        type: _constants2.default.DID_NOT_COMPLETE_UPLOAD_TO_AWS
    };
};

var addError = exports.addError = function addError(error) {
    return {
        type: _constants2.default.ADD_ERROR,
        error: error
    };
};

var clearErrors = exports.clearErrors = function clearErrors() {
    return {
        type: _constants2.default.CLEAR_ERRORS
    };
};

var updateProgress = exports.updateProgress = function updateProgress() {
    var progress = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    return {
        type: _constants2.default.UPDATE_PROGRESS,
        progress: progress
    };
};

},{"../constants":3,"../store":8,"../utils":9}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.View = undefined;

var _actions = require('../actions');

var _store = require('../store');

var _utils = require('../utils');

var View = function View(element, store) {
    return {
        renderFilename: function renderFilename() {
            var filename = (0, _store.getFilename)(store),
                url = (0, _store.getUrl)(store);

            if (filename && url) {
                this.$link.innerHTML = filename;
                this.$link.setAttribute('href', url);
                this.$url.value = url.split("?")[0];

                this.$element.classList.add('link-active');
                this.$element.classList.remove('form-active');
            } else {
                this.$url.value = '';
                this.$input.value = '';

                this.$element.classList.add('form-active');
                this.$element.classList.remove('link-active');
            }
        },

        renderError: function renderError() {
            var error = (0, _store.getError)(store);

            if (error) {
                this.$element.classList.add('has-error');
                this.$element.classList.add('form-active');
                this.$element.classList.remove('link-active');

                this.$element.querySelector('.s3upload__file-input').value = '';
                this.$element.querySelector('.s3upload__error').innerHTML = error;
            } else {
                this.$element.classList.remove('has-error');
                this.$element.querySelector('.s3upload__error').innerHTML = '';
            }
        },

        renderUploadProgress: function renderUploadProgress() {
            var uploadProgress = (0, _store.getUploadProgress)(store);

            if (uploadProgress > 0) {
                this.$element.classList.add('progress-active');
                this.$bar.style.width = uploadProgress + '%';
            } else {
                this.$element.classList.remove('progress-active');
                this.$bar.style.width = '0';
            }
        },

        removeUpload: function removeUpload(event) {
            event.preventDefault();

            store.dispatch((0, _actions.updateProgress)());
            store.dispatch((0, _actions.removeUpload)());
            (0, _utils.raiseEvent)(this.$element, 's3upload:clear-upload');
        },

        getUploadURL: function getUploadURL(event) {
            var file = this.$input.files[0],
                dest = this.$dest.value,
                url = this.$element.getAttribute('data-policy-url');

            store.dispatch((0, _actions.clearErrors)());
            store.dispatch((0, _actions.getUploadURL)(file, dest, url, store));
        },

        init: function init() {
            // cache all the query selectors
            // $variables represent DOM elements
            this.$element = element;
            this.$url = element.querySelector('.s3upload__file-url');
            this.$input = element.querySelector('.s3upload__file-input');
            this.$remove = element.querySelector('.s3upload__file-remove');
            this.$dest = element.querySelector('.s3upload__file-dest');
            this.$link = element.querySelector('.s3upload__file-link');
            this.$error = element.querySelector('.s3upload__error');
            this.$bar = element.querySelector('.s3upload__bar');

            // set initial DOM states3upload__
            var status = this.$url.value === '' ? 'form' : 'link';
            this.$element.classList.add(status + '-active');

            // add event listeners
            this.$remove.addEventListener('click', this.removeUpload.bind(this));
            this.$input.addEventListener('change', this.getUploadURL.bind(this));

            // these three observers subscribe to the store, but only trigger their
            // callbacks when the specific piece of state they observe changes.
            // this allows for a less naive approach to rendering changes than a
            // render method subscribed to the whole state.
            var filenameObserver = (0, _utils.observeStore)(store, function (state) {
                return state.appStatus.filename;
            }, this.renderFilename.bind(this));

            var errorObserver = (0, _utils.observeStore)(store, function (state) {
                return state.appStatus.error;
            }, this.renderError.bind(this));

            var uploadProgressObserver = (0, _utils.observeStore)(store, function (state) {
                return state.appStatus.uploadProgress;
            }, this.renderUploadProgress.bind(this));
        }
    };
};

exports.View = View;

},{"../actions":1,"../store":8,"../utils":9}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = {
    REQUEST_AWS_UPLOAD_PARAMS: 'REQUEST_AWS_UPLOAD_PARAMS',
    RECEIVE_AWS_UPLOAD_PARAMS: 'RECEIVE_AWS_UPLOAD_PARAMS',
    DID_NOT_RECEIVE_AWS_UPLOAD_PARAMS: 'DID_NOT_RECEIVE_AWS_UPLOAD_PARAMS',
    REMOVE_UPLOAD: 'REMOVE_UPLOAD',
    BEGIN_UPLOAD_TO_AWS: 'BEGIN_UPLOAD_TO_AWS',
    COMPLETE_UPLOAD_TO_AWS: 'COMPLETE_UPLOAD_TO_AWS',
    DID_NOT_COMPLETE_UPLOAD_TO_AWS: 'DID_NOT_COMPLETE_UPLOAD_TO_AWS',
    ADD_ERROR: 'ADD_ERROR',
    CLEAR_ERRORS: 'CLEAR_ERRORS',
    UPDATE_PROGRESS: 'UPDATE_PROGRESS',
    RECEIVE_SIGNED_URL: 'RECEIVE_SIGNED_URL'
};


var i18n_strings = void 0;

try {
    exports.i18n_strings = i18n_strings = djangoS3Upload.i18n_strings;
} catch (e) {
    exports.i18n_strings = i18n_strings = {
        "no_upload_failed": "Sorry, failed to upload file.",
        "no_upload_url": "Sorry, could not get upload URL.",
        "no_file_too_large": "Sorry, the file is too large to be uploaded.",
        "no_file_too_small": "Sorry, the file is too small to be uploaded."
    };
}

exports.i18n_strings = i18n_strings;

},{}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _constants = require('../constants');

var _constants2 = _interopRequireDefault(_constants);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function () {
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var action = arguments[1];

    switch (action.type) {
        case _constants2.default.BEGIN_UPLOAD_TO_AWS:
            return Object.assign({}, state, {
                isUploading: true
            });
        case _constants2.default.COMPLETE_UPLOAD_TO_AWS:
            return Object.assign({}, state, {
                isUploading: false,
                uploadProgress: 0,
                filename: action.filename,
                url: action.url
            });
        case _constants2.default.DID_NOT_COMPLETE_UPLOAD_TO_AWS:
            return Object.assign({}, state, {
                isUploading: false
            });
        case _constants2.default.REMOVE_UPLOAD:
            return Object.assign({}, state, {
                filename: null,
                url: null
            });
        case _constants2.default.ADD_ERROR:
            return Object.assign({}, state, {
                error: action.error
            });
        case _constants2.default.CLEAR_ERRORS:
            return Object.assign({}, state, {
                error: null
            });
        case _constants2.default.UPDATE_PROGRESS:
            return Object.assign({}, state, {
                uploadProgress: action.progress
            });
        case _constants2.default.RECEIVE_SIGNED_URL:
            {
                return Object.assign({}, state, {
                    signedURL: action.signedURL
                });
            }

        default:
            return state;
    }
};

},{"../constants":3}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _constants = require('../constants');

var _constants2 = _interopRequireDefault(_constants);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function () {
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var action = arguments[1];

    switch (action.type) {
        case _constants2.default.REQUEST_AWS_UPLOAD_PARAMS:
            return Object.assign({}, state, {
                isLoading: true
            });
        case _constants2.default.RECEIVE_AWS_UPLOAD_PARAMS:
            return Object.assign({}, state, {
                isLoading: false,
                AWSPayload: action.aws_payload
            });
        case _constants2.default.DID_NOT_RECEIVE_AWS_UPLOAD_PARAMS:
            // Returns current state and sets loading to false
            return Object.assign({}, state, {
                isLoading: false
            });
        default:
            return state; // reducer must return by default
    }
};

},{"../constants":3}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _redux = require('redux');

var _awsUploadsParams = require('./awsUploadsParams');

var _awsUploadsParams2 = _interopRequireDefault(_awsUploadsParams);

var _appStatus = require('./appStatus');

var _appStatus2 = _interopRequireDefault(_appStatus);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var element = function element() {
  var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var action = arguments[1];

  return state; // reducer must return by default
};

exports.default = (0, _redux.combineReducers)({
  AWSUploadParams: _awsUploadsParams2.default,
  appStatus: _appStatus2.default,
  element: element
});

},{"./appStatus":4,"./awsUploadsParams":5,"redux":26}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getFilename = getFilename;
exports.getUrl = getUrl;
exports.getError = getError;
exports.getUploadProgress = getUploadProgress;
exports.getElement = getElement;
exports.getAWSPayload = getAWSPayload;
function getFilename(store) {
    return store.getState().appStatus.filename;
}

function getUrl(store) {
    var url = store.getState().appStatus.signedURL || store.getState().appStatus.url;

    return url;
}

function getError(store) {
    return store.getState().appStatus.error;
}

function getUploadProgress(store) {
    return store.getState().appStatus.uploadProgress;
}

function getElement(store) {
    return store.getState().element;
}

function getAWSPayload(store) {
    return store.getState().AWSUploadParams.AWSPayload;
}

},{}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = configureStore;

var _connect = require('./connect');

Object.keys(_connect).forEach(function (key) {
    if (key === "default" || key === "__esModule") return;
    Object.defineProperty(exports, key, {
        enumerable: true,
        get: function get() {
            return _connect[key];
        }
    });
});

var _redux = require('redux');

var _reducers = require('../reducers');

var _reducers2 = _interopRequireDefault(_reducers);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _window = window,
    devToolsExtension = _window.devToolsExtension;
function configureStore(initialState) {
    return (0, _redux.createStore)(_reducers2.default, initialState, devToolsExtension && devToolsExtension());
}

},{"../reducers":6,"./connect":7,"redux":26}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.observeStore = exports.raiseEvent = exports.parseJson = exports.parseNameFromUrl = exports.parseURL = exports.request = exports.getCookie = undefined;

var _constants = require('../constants');

var getCookie = exports.getCookie = function getCookie(name) {
    var value = '; ' + document.cookie,
        parts = value.split('; ' + name + '=');
    if (parts.length == 2) return parts.pop().split(';').shift();
};

var request = exports.request = function request(method, url, data, headers, onProgress, onLoad, onError) {
    var request = new XMLHttpRequest();
    request.open(method, url, true);

    Object.keys(headers).forEach(function (key) {
        request.setRequestHeader(key, headers[key]);
    });

    request.onload = function () {
        onLoad(request.status, request.responseText);
    };

    if (onError) {
        request.onerror = request.onabort = function () {
            onError(request.status, request.responseText);
        };
    }

    if (onProgress) {
        request.upload.onprogress = function (data) {
            onProgress(data);
        };
    }

    request.send(data);
};

var parseURL = exports.parseURL = function parseURL(text) {
    var xml = new DOMParser().parseFromString(text, 'text/xml'),
        tag = xml.getElementsByTagName('Location')[0],
        url = decodeURIComponent(tag.childNodes[0].nodeValue);

    return url;
};

var parseNameFromUrl = exports.parseNameFromUrl = function parseNameFromUrl(url) {
    return decodeURIComponent((url + '').replace(/\+/g, '%20'));
};

var parseJson = exports.parseJson = function parseJson(json) {
    var data;

    try {
        data = JSON.parse(json);
    } catch (error) {
        data = null;
    };

    return data;
};

var raiseEvent = exports.raiseEvent = function raiseEvent(element, name, detail) {
    if (window.CustomEvent) {
        var event = new CustomEvent(name, { detail: detail, bubbles: true });
        element.dispatchEvent(event);
    }
};

var observeStore = exports.observeStore = function observeStore(store, select, onChange) {
    var currentState = void 0;

    function handleChange() {
        var nextState = select(store.getState());

        if (nextState !== currentState) {
            currentState = nextState;
            onChange(currentState);
        }
    }

    var unsubscribe = store.subscribe(handleChange);
    handleChange();
    return unsubscribe;
};

},{"../constants":3}],10:[function(require,module,exports){
'use strict';

var _store = require('./store');

var _store2 = _interopRequireDefault(_store);

var _components = require('./components');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function addHandlers(elements) {
    // safari doesn't like forEach on nodeList objects
    for (var i = 0; i < elements.length; i++) {
        // initialise instance for each element
        var element = elements[i];
        var store = (0, _store2.default)({ element: element });
        var view = new _components.View(element, store);
        view.init();
    }
}
// by default initHandler inits on '.s3upload', but if passed a custom
// selector in the event data, it will init on that instead.
function initHandler(event) {
    var selector = '.s3upload';

    if (event.detail && event.detail.selector) {
        selector = event.detail.selector;
    }

    var elements = document.querySelectorAll(selector);

    addHandlers(elements);
}

// default global init on document ready
document.addEventListener('DOMContentLoaded', initHandler);

// Support inline
document.addEventListener('DOMNodeInserted', function(event) {
    if(event.target.tagName) {
        var elements = event.target.querySelectorAll('.s3upload');
        addHandlers(elements)
    }
});

// custom event listener for use in async init
document.addEventListener('s3upload:init', initHandler);

},{"./components":2,"./store":8}],11:[function(require,module,exports){
var root = require('./_root');

/** Built-in value references. */
var Symbol = root.Symbol;

module.exports = Symbol;

},{"./_root":18}],12:[function(require,module,exports){
var Symbol = require('./_Symbol'),
    getRawTag = require('./_getRawTag'),
    objectToString = require('./_objectToString');

/** `Object#toString` result references. */
var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

module.exports = baseGetTag;

},{"./_Symbol":11,"./_getRawTag":15,"./_objectToString":16}],13:[function(require,module,exports){
(function (global){
/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

module.exports = freeGlobal;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],14:[function(require,module,exports){
var overArg = require('./_overArg');

/** Built-in value references. */
var getPrototype = overArg(Object.getPrototypeOf, Object);

module.exports = getPrototype;

},{"./_overArg":17}],15:[function(require,module,exports){
var Symbol = require('./_Symbol');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}

module.exports = getRawTag;

},{"./_Symbol":11}],16:[function(require,module,exports){
/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

module.exports = objectToString;

},{}],17:[function(require,module,exports){
/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

module.exports = overArg;

},{}],18:[function(require,module,exports){
var freeGlobal = require('./_freeGlobal');

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

module.exports = root;

},{"./_freeGlobal":13}],19:[function(require,module,exports){
/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],20:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    getPrototype = require('./_getPrototype'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
    return false;
  }
  var proto = getPrototype(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor == 'function' && Ctor instanceof Ctor &&
    funcToString.call(Ctor) == objectCtorString;
}

module.exports = isPlainObject;

},{"./_baseGetTag":12,"./_getPrototype":14,"./isObjectLike":19}],21:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports['default'] = applyMiddleware;

var _compose = require('./compose');

var _compose2 = _interopRequireDefault(_compose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
function applyMiddleware() {
  for (var _len = arguments.length, middlewares = Array(_len), _key = 0; _key < _len; _key++) {
    middlewares[_key] = arguments[_key];
  }

  return function (createStore) {
    return function (reducer, preloadedState, enhancer) {
      var store = createStore(reducer, preloadedState, enhancer);
      var _dispatch = store.dispatch;
      var chain = [];

      var middlewareAPI = {
        getState: store.getState,
        dispatch: function dispatch(action) {
          return _dispatch(action);
        }
      };
      chain = middlewares.map(function (middleware) {
        return middleware(middlewareAPI);
      });
      _dispatch = _compose2['default'].apply(undefined, chain)(store.dispatch);

      return _extends({}, store, {
        dispatch: _dispatch
      });
    };
  };
}
},{"./compose":24}],22:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports['default'] = bindActionCreators;
function bindActionCreator(actionCreator, dispatch) {
  return function () {
    return dispatch(actionCreator.apply(undefined, arguments));
  };
}

/**
 * Turns an object whose values are action creators, into an object with the
 * same keys, but with every function wrapped into a `dispatch` call so they
 * may be invoked directly. This is just a convenience method, as you can call
 * `store.dispatch(MyActionCreators.doSomething())` yourself just fine.
 *
 * For convenience, you can also pass a single function as the first argument,
 * and get a function in return.
 *
 * @param {Function|Object} actionCreators An object whose values are action
 * creator functions. One handy way to obtain it is to use ES6 `import * as`
 * syntax. You may also pass a single function.
 *
 * @param {Function} dispatch The `dispatch` function available on your Redux
 * store.
 *
 * @returns {Function|Object} The object mimicking the original object, but with
 * every action creator wrapped into the `dispatch` call. If you passed a
 * function as `actionCreators`, the return value will also be a single
 * function.
 */
function bindActionCreators(actionCreators, dispatch) {
  if (typeof actionCreators === 'function') {
    return bindActionCreator(actionCreators, dispatch);
  }

  if (typeof actionCreators !== 'object' || actionCreators === null) {
    throw new Error('bindActionCreators expected an object or a function, instead received ' + (actionCreators === null ? 'null' : typeof actionCreators) + '. ' + 'Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?');
  }

  var keys = Object.keys(actionCreators);
  var boundActionCreators = {};
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var actionCreator = actionCreators[key];
    if (typeof actionCreator === 'function') {
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
    }
  }
  return boundActionCreators;
}
},{}],23:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports['default'] = combineReducers;

var _createStore = require('./createStore');

var _isPlainObject = require('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _warning = require('./utils/warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function getUndefinedStateErrorMessage(key, action) {
  var actionType = action && action.type;
  var actionName = actionType && '"' + actionType.toString() + '"' || 'an action';

  return 'Given action ' + actionName + ', reducer "' + key + '" returned undefined. ' + 'To ignore an action, you must explicitly return the previous state. ' + 'If you want this reducer to hold no value, you can return null instead of undefined.';
}

function getUnexpectedStateShapeWarningMessage(inputState, reducers, action, unexpectedKeyCache) {
  var reducerKeys = Object.keys(reducers);
  var argumentName = action && action.type === _createStore.ActionTypes.INIT ? 'preloadedState argument passed to createStore' : 'previous state received by the reducer';

  if (reducerKeys.length === 0) {
    return 'Store does not have a valid reducer. Make sure the argument passed ' + 'to combineReducers is an object whose values are reducers.';
  }

  if (!(0, _isPlainObject2['default'])(inputState)) {
    return 'The ' + argumentName + ' has unexpected type of "' + {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] + '". Expected argument to be an object with the following ' + ('keys: "' + reducerKeys.join('", "') + '"');
  }

  var unexpectedKeys = Object.keys(inputState).filter(function (key) {
    return !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key];
  });

  unexpectedKeys.forEach(function (key) {
    unexpectedKeyCache[key] = true;
  });

  if (unexpectedKeys.length > 0) {
    return 'Unexpected ' + (unexpectedKeys.length > 1 ? 'keys' : 'key') + ' ' + ('"' + unexpectedKeys.join('", "') + '" found in ' + argumentName + '. ') + 'Expected to find one of the known reducer keys instead: ' + ('"' + reducerKeys.join('", "') + '". Unexpected keys will be ignored.');
  }
}

function assertReducerShape(reducers) {
  Object.keys(reducers).forEach(function (key) {
    var reducer = reducers[key];
    var initialState = reducer(undefined, { type: _createStore.ActionTypes.INIT });

    if (typeof initialState === 'undefined') {
      throw new Error('Reducer "' + key + '" returned undefined during initialization. ' + 'If the state passed to the reducer is undefined, you must ' + 'explicitly return the initial state. The initial state may ' + 'not be undefined. If you don\'t want to set a value for this reducer, ' + 'you can use null instead of undefined.');
    }

    var type = '@@redux/PROBE_UNKNOWN_ACTION_' + Math.random().toString(36).substring(7).split('').join('.');
    if (typeof reducer(undefined, { type: type }) === 'undefined') {
      throw new Error('Reducer "' + key + '" returned undefined when probed with a random type. ' + ('Don\'t try to handle ' + _createStore.ActionTypes.INIT + ' or other actions in "redux/*" ') + 'namespace. They are considered private. Instead, you must return the ' + 'current state for any unknown actions, unless it is undefined, ' + 'in which case you must return the initial state, regardless of the ' + 'action type. The initial state may not be undefined, but can be null.');
    }
  });
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */
function combineReducers(reducers) {
  var reducerKeys = Object.keys(reducers);
  var finalReducers = {};
  for (var i = 0; i < reducerKeys.length; i++) {
    var key = reducerKeys[i];

    if ("production" !== 'production') {
      if (typeof reducers[key] === 'undefined') {
        (0, _warning2['default'])('No reducer provided for key "' + key + '"');
      }
    }

    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key];
    }
  }
  var finalReducerKeys = Object.keys(finalReducers);

  var unexpectedKeyCache = void 0;
  if ("production" !== 'production') {
    unexpectedKeyCache = {};
  }

  var shapeAssertionError = void 0;
  try {
    assertReducerShape(finalReducers);
  } catch (e) {
    shapeAssertionError = e;
  }

  return function combination() {
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var action = arguments[1];

    if (shapeAssertionError) {
      throw shapeAssertionError;
    }

    if ("production" !== 'production') {
      var warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action, unexpectedKeyCache);
      if (warningMessage) {
        (0, _warning2['default'])(warningMessage);
      }
    }

    var hasChanged = false;
    var nextState = {};
    for (var _i = 0; _i < finalReducerKeys.length; _i++) {
      var _key = finalReducerKeys[_i];
      var reducer = finalReducers[_key];
      var previousStateForKey = state[_key];
      var nextStateForKey = reducer(previousStateForKey, action);
      if (typeof nextStateForKey === 'undefined') {
        var errorMessage = getUndefinedStateErrorMessage(_key, action);
        throw new Error(errorMessage);
      }
      nextState[_key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    return hasChanged ? nextState : state;
  };
}
},{"./createStore":25,"./utils/warning":27,"lodash/isPlainObject":20}],24:[function(require,module,exports){
"use strict";

exports.__esModule = true;
exports["default"] = compose;
/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */

function compose() {
  for (var _len = arguments.length, funcs = Array(_len), _key = 0; _key < _len; _key++) {
    funcs[_key] = arguments[_key];
  }

  if (funcs.length === 0) {
    return function (arg) {
      return arg;
    };
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce(function (a, b) {
    return function () {
      return a(b.apply(undefined, arguments));
    };
  });
}
},{}],25:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.ActionTypes = undefined;
exports['default'] = createStore;

var _isPlainObject = require('lodash/isPlainObject');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _symbolObservable = require('symbol-observable');

var _symbolObservable2 = _interopRequireDefault(_symbolObservable);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
var ActionTypes = exports.ActionTypes = {
  INIT: '@@redux/INIT'

  /**
   * Creates a Redux store that holds the state tree.
   * The only way to change the data in the store is to call `dispatch()` on it.
   *
   * There should only be a single store in your app. To specify how different
   * parts of the state tree respond to actions, you may combine several reducers
   * into a single reducer function by using `combineReducers`.
   *
   * @param {Function} reducer A function that returns the next state tree, given
   * the current state tree and the action to handle.
   *
   * @param {any} [preloadedState] The initial state. You may optionally specify it
   * to hydrate the state from the server in universal apps, or to restore a
   * previously serialized user session.
   * If you use `combineReducers` to produce the root reducer function, this must be
   * an object with the same shape as `combineReducers` keys.
   *
   * @param {Function} [enhancer] The store enhancer. You may optionally specify it
   * to enhance the store with third-party capabilities such as middleware,
   * time travel, persistence, etc. The only store enhancer that ships with Redux
   * is `applyMiddleware()`.
   *
   * @returns {Store} A Redux store that lets you read the state, dispatch actions
   * and subscribe to changes.
   */
};function createStore(reducer, preloadedState, enhancer) {
  var _ref2;

  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState;
    preloadedState = undefined;
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.');
    }

    return enhancer(createStore)(reducer, preloadedState);
  }

  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.');
  }

  var currentReducer = reducer;
  var currentState = preloadedState;
  var currentListeners = [];
  var nextListeners = currentListeners;
  var isDispatching = false;

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */
  function getState() {
    return currentState;
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Expected listener to be a function.');
    }

    var isSubscribed = true;

    ensureCanMutateNextListeners();
    nextListeners.push(listener);

    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }

      isSubscribed = false;

      ensureCanMutateNextListeners();
      var index = nextListeners.indexOf(listener);
      nextListeners.splice(index, 1);
    };
  }

  /**
   * Dispatches an action. It is the only way to trigger a state change.
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */
  function dispatch(action) {
    if (!(0, _isPlainObject2['default'])(action)) {
      throw new Error('Actions must be plain objects. ' + 'Use custom middleware for async actions.');
    }

    if (typeof action.type === 'undefined') {
      throw new Error('Actions may not have an undefined "type" property. ' + 'Have you misspelled a constant?');
    }

    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.');
    }

    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }

    var listeners = currentListeners = nextListeners;
    for (var i = 0; i < listeners.length; i++) {
      var listener = listeners[i];
      listener();
    }

    return action;
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.');
    }

    currentReducer = nextReducer;
    dispatch({ type: ActionTypes.INIT });
  }

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/tc39/proposal-observable
   */
  function observable() {
    var _ref;

    var outerSubscribe = subscribe;
    return _ref = {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe: function subscribe(observer) {
        if (typeof observer !== 'object') {
          throw new TypeError('Expected the observer to be an object.');
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState());
          }
        }

        observeState();
        var unsubscribe = outerSubscribe(observeState);
        return { unsubscribe: unsubscribe };
      }
    }, _ref[_symbolObservable2['default']] = function () {
      return this;
    }, _ref;
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT });

  return _ref2 = {
    dispatch: dispatch,
    subscribe: subscribe,
    getState: getState,
    replaceReducer: replaceReducer
  }, _ref2[_symbolObservable2['default']] = observable, _ref2;
}
},{"lodash/isPlainObject":20,"symbol-observable":28}],26:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.compose = exports.applyMiddleware = exports.bindActionCreators = exports.combineReducers = exports.createStore = undefined;

var _createStore = require('./createStore');

var _createStore2 = _interopRequireDefault(_createStore);

var _combineReducers = require('./combineReducers');

var _combineReducers2 = _interopRequireDefault(_combineReducers);

var _bindActionCreators = require('./bindActionCreators');

var _bindActionCreators2 = _interopRequireDefault(_bindActionCreators);

var _applyMiddleware = require('./applyMiddleware');

var _applyMiddleware2 = _interopRequireDefault(_applyMiddleware);

var _compose = require('./compose');

var _compose2 = _interopRequireDefault(_compose);

var _warning = require('./utils/warning');

var _warning2 = _interopRequireDefault(_warning);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/*
* This is a dummy function to check if the function name has been altered by minification.
* If the function has been minified and NODE_ENV !== 'production', warn the user.
*/
function isCrushed() {}

if ("production" !== 'production' && typeof isCrushed.name === 'string' && isCrushed.name !== 'isCrushed') {
  (0, _warning2['default'])('You are currently using minified code outside of NODE_ENV === \'production\'. ' + 'This means that you are running a slower development build of Redux. ' + 'You can use loose-envify (https://github.com/zertosh/loose-envify) for browserify ' + 'or DefinePlugin for webpack (http://stackoverflow.com/questions/30030031) ' + 'to ensure you have the correct code for your production build.');
}

exports.createStore = _createStore2['default'];
exports.combineReducers = _combineReducers2['default'];
exports.bindActionCreators = _bindActionCreators2['default'];
exports.applyMiddleware = _applyMiddleware2['default'];
exports.compose = _compose2['default'];
},{"./applyMiddleware":21,"./bindActionCreators":22,"./combineReducers":23,"./compose":24,"./createStore":25,"./utils/warning":27}],27:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports['default'] = warning;
/**
 * Prints a warning in the console if it exists.
 *
 * @param {String} message The warning message.
 * @returns {void}
 */
function warning(message) {
  /* eslint-disable no-console */
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(message);
  }
  /* eslint-enable no-console */
  try {
    // This error was thrown as a convenience so that if you enable
    // "break on all exceptions" in your console,
    // it would pause the execution at this line.
    throw new Error(message);
    /* eslint-disable no-empty */
  } catch (e) {}
  /* eslint-enable no-empty */
}
},{}],28:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _ponyfill = require('./ponyfill.js');

var _ponyfill2 = _interopRequireDefault(_ponyfill);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var root; /* global window */


if (typeof self !== 'undefined') {
  root = self;
} else if (typeof window !== 'undefined') {
  root = window;
} else if (typeof global !== 'undefined') {
  root = global;
} else if (typeof module !== 'undefined') {
  root = module;
} else {
  root = Function('return this')();
}

var result = (0, _ponyfill2['default'])(root);
exports['default'] = result;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ponyfill.js":29}],29:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports['default'] = symbolObservablePonyfill;
function symbolObservablePonyfill(root) {
	var result;
	var _Symbol = root.Symbol;

	if (typeof _Symbol === 'function') {
		if (_Symbol.observable) {
			result = _Symbol.observable;
		} else {
			result = _Symbol('observable');
			_Symbol.observable = result;
		}
	} else {
		result = '@@observable';
	}

	return result;
};
},{}]},{},[10]);
