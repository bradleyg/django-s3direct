(function(){

    "use strict"

    var i18n_strings;
    try {
        i18n_strings = djangoS3Upload.i18n_strings;
    } catch(e) {
        i18n_strings = {
            "no_upload_failed": "Sorry, failed to upload file.",
            "no_upload_url": "Sorry, could not get upload URL.",
            "no_file_too_large": "Sorry, the file is too large to be uploaded.",
            "no_file_too_small": "Sorry, the file is too small to be uploaded."
        };
    }

    var getCookie = function(name) {
        var value = '; ' + document.cookie,
            parts = value.split('; ' + name + '=')
        if (parts.length == 2) return parts.pop().split(';').shift()
    }

    var request = function(method, url, data, headers, el, showProgress, cb) {
        var req = new XMLHttpRequest()
        req.open(method, url, true)

        Object.keys(headers).forEach(function(key){
            req.setRequestHeader(key, headers[key])
        })

        req.onload = function() {
            cb(req.status, req.responseText)
        }

        req.onerror = req.onabort = function() {
            disableSubmit(false)
            error(el, i18n_strings.no_upload_failed)
        }

        req.upload.onprogress = function(data) {
            progressBar(el, data, showProgress)
        }

        req.send(data)
    }

    var parseURL = function(text) {
        var xml = new DOMParser().parseFromString(text, 'text/xml'),
            tag = xml.getElementsByTagName('Location')[0],
            url = decodeURIComponent(tag.childNodes[0].nodeValue)

        return url;
    }

    var parseNameFromUrl = function(url) {
        return decodeURIComponent((url + '').replace(/\+/g, '%20'));
    }

    var parseJson = function(json) {
        var data
        try {data = JSON.parse(json)}
        catch(e){ data = null }
        return data
    }

    var progressBar = function(el, data, showProgress) {
        if(data.lengthComputable === false || showProgress === false) return

        var pcnt = Math.round(data.loaded * 100 / data.total),
            bar  = el.querySelector('.bar')

        bar.style.width = pcnt + '%'
    }

    var error = function(el, msg) {
        el.className = 's3direct form-active'
        el.querySelector('.file-input').value = ''
        alert(msg)
    }

    var update = function(el, xml) {
        var link = el.querySelector('.file-link'),
            url  = el.querySelector('.file-url')

        url.value = parseURL(xml)
        link.setAttribute('href', url.value)
        link.innerHTML = parseNameFromUrl(url.value).split('/').pop();

        el.className = 's3direct link-active'
        el.querySelector('.bar').style.width = '0%'
    }

    var concurrentUploads = 0
    var disableSubmit = function(status) {
        var submitRow = document.querySelector('.submit-row')
        if( ! submitRow) return

        var buttons = submitRow.querySelectorAll('input[type=submit],button[type=submit]')

        if (status === true) concurrentUploads++
        else concurrentUploads--

        ;[].forEach.call(buttons, function(el){
            el.disabled = (concurrentUploads !== 0)
        })
    }

    var upload = function(file, data, el) {
        var form = new FormData()

        disableSubmit(true)

        if (data === null) return error(el, i18n_strings.no_upload_url)

        el.className = 's3direct progress-active'
        var url  = data['form_action']
        delete data['form_action']

        Object.keys(data).forEach(function(key){
            form.append(key, data[key])
        })
        form.append('file', file)

        request('POST', url, form, {}, el, true, function(status, xml){
            disableSubmit(false)
            if(status !== 201) {
                if (xml.indexOf('<MinSizeAllowed>') > -1) {
                    return error(el, i18n_strings.no_file_too_small)
                }
                else if (xml.indexOf('<MaxSizeAllowed>') > -1) {
                    return error(el, i18n_strings.no_file_too_large)
                }

                return error(el, i18n_strings.no_upload_failed)
            }
            update(el, xml)
        })
    }

    var getUploadURL = function(e) {
        var el       = e.target.parentElement,
            file     = el.querySelector('.file-input').files[0],
            dest     = el.querySelector('.file-dest').value,
            url      = el.getAttribute('data-policy-url'),
            form     = new FormData(),
            headers  = {'X-CSRFToken': getCookie('csrftoken')}

        form.append('type', file.type)
        form.append('name', file.name)
        form.append('dest', dest)

        request('POST', url, form, headers, el, false, function(status, json){
            var data = parseJson(json)

            switch(status) {
                case 200:
                    upload(file, data.aws_payload, el)
                    break
                case 400:
                case 403:
                    error(el, data.error)
                    break;
                default:
                    error(el, i18n_strings.no_upload_url)
            }
        })
    }

    var removeUpload = function(e) {
        e.preventDefault()

        var el = e.target.parentElement
        el.querySelector('.file-url').value = ''
        el.querySelector('.file-input').value = ''
        el.className = 's3direct form-active'
    }

    var addHandlers = function(el) {
        var url    = el.querySelector('.file-url'),
            input  = el.querySelector('.file-input'),
            remove = el.querySelector('.file-remove'),
            status = (url.value === '') ? 'form' : 'link'

        el.className = 's3direct ' + status + '-active'

        remove.addEventListener('click', removeUpload, false)
        input.addEventListener('change', getUploadURL, false)
    }

    document.addEventListener('DOMContentLoaded', function(e) {
        ;[].forEach.call(document.querySelectorAll('.s3direct'), addHandlers)
    })

    document.addEventListener('DOMNodeInserted', function(e){
        if(e.target.tagName) {
            var el = e.target.querySelectorAll('.s3direct');
            [].forEach.call(el, function (element, index, array) {
        addHandlers(element);
        });
        }
    })
})()
