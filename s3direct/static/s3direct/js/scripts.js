const Cookies = require('js-cookie');
const createHash = require('sha.js')
const Evaporate = require('evaporate');
const SparkMD5 = require('spark-md5');


(function(){

    "use strict"

    var request = function(method, url, data, headers, el, cb) {
        let req = new XMLHttpRequest()
        req.open(method, url, true)

        Object.keys(headers).forEach(function(key){
            req.setRequestHeader(key, headers[key])
        })

        req.onload = function() {
            cb(req.status, req.responseText)
        }

        req.onerror = req.onabort = function() {
            disableSubmit(false)
            error(el, 'Sorry, failed to upload file.')
        }

        req.send(data)
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

    var updateProgressBar = function(element, progressRatio) {
        var bar = element.querySelector('.bar');
        bar.style.width = Math.round(progressRatio * 100) + '%';
    };

    var error = function(el, msg) {
        el.className = 's3direct form-active'
        el.querySelector('.file-input').value = ''
        alert(msg)
    }

    var concurrentUploads = 0;

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

    const beginUpload = function (element) {
        disableSubmit(true);
        element.className = 's3direct progress-active'
    };

    const finishUpload = function (element, awsBucketUrl, objectKey) {
        const link = element.querySelector('.file-link');
        const url = element.querySelector('.file-url');
        url.value = awsBucketUrl + '/' + objectKey;
        link.setAttribute('href', url.value);
        link.innerHTML = parseNameFromUrl(url.value).split('/').pop();

        element.className = 's3direct link-active';
        element.querySelector('.bar').style.width = '0%';
        disableSubmit(false);
    };

    const computeMd5 = function (data) {
        return btoa(SparkMD5.ArrayBuffer.hash(data, true));
    };

    const computeSha256 = function (data) {
        return createHash('sha256').update(data, 'utf-8').digest('hex');
    };

    const initiateMultipartUpload = function (element, signingUrl, objectKey, awsKey, awsRegion, awsBucket, awsBucketUrl, cacheControl, contentDisposition, acl, serverSideEncryption, file) {
        // Enclosed so we can propagate errors to the correct `element` in case of failure.
        const getAwsV4Signature = function (signParams, signHeaders, stringToSign, signatureDateTime, canonicalRequest) {
            return new Promise(function (resolve, reject) {
                const form = new FormData();
                form.append('to_sign', stringToSign);
                form.append('datetime', signatureDateTime);
                const headers = {'X-CSRFToken': Cookies.get('csrftoken')};
                request('POST', signingUrl, form, headers, element, function (status, response) {
                    switch (status) {
                        case 200:
                            resolve(response);
                            break;
                        default:
                            error(element, 'Could not generate AWS v4 signature.')
                            reject();
                            break;
                    }
                });
            })
        };

        const generateAmazonHeaders = function (acl, serverSideEncryption) {
            // Either of these may be null, so don't add them unless they exist:
            let headers = {}
            if (acl) headers['x-amz-acl'] = acl;
            if (serverSideEncryption) headers['x-amz-server-side-encryption'] = serverSideEncryption;
            return headers;
        };

        Evaporate.create(
            {
                //signerUrl: signingUrl,
                customAuthMethod: getAwsV4Signature,
                aws_key: awsKey,
                bucket: awsBucket,
                awsRegion: awsRegion,
                computeContentMd5: true,
                cryptoMd5Method: computeMd5,
                cryptoHexEncodedHash256: computeSha256,
                partSize: 20 * 1024 * 1024,
                logging: true,
                debug: true,
            }
        ).then(function (evaporate) {
            beginUpload(element);
            evaporate.add({
                name: objectKey,
                file: file,
                contentType: file.type,
                xAmzHeadersAtInitiate: generateAmazonHeaders(acl, serverSideEncryption),
                notSignedHeadersAtInitiate: {'Cache-Control': cacheControl, 'Content-Disposition': contentDisposition},
                progress: function (progressRatio, stats) { updateProgressBar(element, progressRatio); },
            }).then(
                function (awsS3ObjectKey) {
                    console.log('Successfully uploaded to:', awsS3ObjectKey);
                    finishUpload(element, awsBucketUrl, awsS3ObjectKey);
                },
                function (reason) {
                    console.error('Failed to upload because:', reason);
                    return error(element, reason)
                }
            )
        });
    };

    var checkFileAndInitiateUpload = function(event) {
        console.log('Checking file and initiating upload…')
        var element             = event.target.parentElement,
            file                = element.querySelector('.file-input').files[0],
            dest                = element.querySelector('.file-dest').value,
            destinationCheckUrl = element.getAttribute('data-policy-url'),
            signerUrl           = element.getAttribute('data-signing-url'),
            form                = new FormData(),
            headers             = {'X-CSRFToken': Cookies.get('csrftoken')};

        form.append('dest', dest)
        form.append('name', file.name)
        form.append('type', file.type)
        form.append('size', file.size)
        request('POST', destinationCheckUrl, form, headers, element, function(status, response) {
            const uploadParameters = parseJson(response)
            switch(status) {
                case 200:
                    initiateMultipartUpload(
                        element,
                        signerUrl,
                        uploadParameters.object_key,
                        uploadParameters.access_key_id,
                        uploadParameters.region,
                        uploadParameters.bucket,
                        uploadParameters.bucket_url,
                        uploadParameters.cache_control,
                        uploadParameters.content_disposition,
                        uploadParameters.acl,
                        uploadParameters.server_side_encryption,
                        file
                    );
                    break;
                case 400:
                case 403:
                case 500:
                    error(element, uploadParameters.error)
                    break;
                default:
                    error(element, 'Sorry, could not get upload URL.')
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
        console.log('Adding django-s3direct handlers…');
        var url    = el.querySelector('.file-url'),
            input  = el.querySelector('.file-input'),
            remove = el.querySelector('.file-remove'),
            status = (url.value === '') ? 'form' : 'link'

        el.className = 's3direct ' + status + '-active'

        remove.addEventListener('click', removeUpload, false)
        input.addEventListener('change', checkFileAndInitiateUpload, false)
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
