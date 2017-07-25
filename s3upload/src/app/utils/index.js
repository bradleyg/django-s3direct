import {i18n_strings} from '../constants';

export const getCookie = function(name) {
    var value = '; ' + document.cookie,
        parts = value.split('; ' + name + '=');
    if (parts.length == 2) return parts.pop().split(';').shift();
}

export const request = function(method, url, data, headers, onProgress, onLoad, onError) {
    var request = new XMLHttpRequest();
    request.open(method, url, true);

    Object.keys(headers).forEach(function(key){
        request.setRequestHeader(key, headers[key]);
    });

    request.onload = function() {
        onLoad(request.status, request.responseText);
    }

    if (onError) {
        request.onerror = request.onabort = function() {
            onError(request.status, request.responseText);
        }
    }

    if (onProgress) {
        request.upload.onprogress = function(data) {
            onProgress(data);
        }
    }

    request.send(data);
}

export const parseURL = function(text) {
    var xml = new DOMParser().parseFromString(text, 'text/xml'),
        tag = xml.getElementsByTagName('Location')[0],
        url = decodeURIComponent(tag.childNodes[0].nodeValue);

    return url;
}

export const parseNameFromUrl = function(url) {
    return decodeURIComponent((url + '').replace(/\+/g, '%20'));
}

export const parseJson = function(json) {
    var data;

    try {
        data = JSON.parse(json);
    }
    catch(error) {
        data = null;
    };

    return data;
}

export const raiseEvent = function(element, name, detail) {
    if (window.CustomEvent) {
        var event = new CustomEvent(name, {detail, bubbles: true});
        element.dispatchEvent(event);
    }
}

export const observeStore = function(store, select, onChange) {
    let currentState;

    function handleChange() {
        let nextState = select(store.getState());

        if (nextState !== currentState) {
            currentState = nextState;
            onChange(currentState);
        }
    }

    let unsubscribe = store.subscribe(handleChange);
    handleChange();
    return unsubscribe;
}