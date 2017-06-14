import {removeUpload, getUploadURL} from '../actions';


const View = function(element, store) {

    return {
        removeUpload: function(event) {

        },

        getUploadURL: function(event) {

            const file = element.querySelector('.file-input').files[0],
                dest = element.querySelector('.file-dest').value,
                url  = element.getAttribute('data-policy-url');
                // form     = new FormData(),
                // headers  = {'X-CSRFToken': getCookie('csrftoken')}

            // form.append('type', file.type)
            // form.append('name', file.name)
            // form.append('dest', dest)

            // request('POST', url, form, headers, el, false, function(status, json){
            //     var data = parseJson(json)

            //     switch(status) {
            //         case 200:
            //             upload(file, data, el)
            //             break
            //         case 400:
            //         case 403:
            //             error(el, data.error)
            //             break;
            //         default:
            //             error(el, i18n_strings.no_upload_url)
            //     }
            // })

            store.dispatch(getUploadURL(file, dest, url, store));
        },

        init: function() {
            console.log(element, store);

            var url = element.querySelector('.file-url'),
            input  = element.querySelector('.file-input'),
            remove = element.querySelector('.file-remove'),
            status = (url.value === '') ? 'form' : 'link'

            element.className = 's3direct ' + status + '-active'


            // store.subscribe(this.updateScore.bind(this))
            remove.addEventListener('click', this.removeUpload.bind(this))
            input.addEventListener('change', this.getUploadURL.bind(this))
        }
    }
}

export {View};