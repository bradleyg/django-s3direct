import {i18n_strings} from '../constants';

export const getCookie = function(name) {
    var value = '; ' + document.cookie,
        parts = value.split('; ' + name + '=');
    if (parts.length == 2) return parts.pop().split(';').shift();
}

export const request = function(method, url, data, headers, showProgress, callback) {
    var request = new XMLHttpRequest();
    request.open(method, url, true);

    Object.keys(headers).forEach(function(key){
        request.setRequestHeader(key, headers[key]);
    });

    request.onload = function() {
        callback(request.status, request.responseText);
    }

    // req.onerror = req.onabort = function() {
    //     // disableSubmit(false);
    //     error(element, i18n_strings.no_upload_failed);
    // }

    // req.upload.onprogress = function(data) {
    //     progressBar(element, data, showProgress);
    // }

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
        data = JSON.parse(json)
    }
    catch(error) {
        data = null
    };

    return data;
}

export const error = function(element, message) {
    element.className = 's3direct form-active';
    element.querySelector('.file-input').value = '';
    alert(message);
}