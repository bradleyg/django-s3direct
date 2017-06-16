import {removeUpload, getUploadURL, clearErrors} from '../actions';
import {getFilename, getUrl, getError} from '../store';
import {raiseEvent} from '../utils';


const View = function(element, store) {

    return {
        render: function(){
            const filename = getFilename(store),
                url = getUrl(store),
                error = getError(store);

            if (filename) {
                const link = element.querySelector('.file-link');

                link.innerHTML = filename;
                link.setAttribute('href', url);

                element.classList.add('link-active');
                element.classList.remove('form-active');
            }
            else {
                element.querySelector('.file-url').value = '';
                element.querySelector('.file-input').value = '';

                element.classList.add('form-active');
                element.classList.remove('link-active');
            }

            if (error) {
                element.classList.add('has-error');
                element.classList.add('form-active');
                element.classList.remove('link-active');

                element.querySelector('.file-input').value = '';
                element.querySelector('.error').innerHTML = error;

                // dispatch event on the element for external use
                raiseEvent(element, 's3uploads:error', error);
            }
            else {
                element.classList.remove('has-error');
                element.querySelector('.error').innerHTML = '';
            }
        },

        removeUpload: function(event) {
            store.dispatch(removeUpload());
        },

        getUploadURL: function(event) {
            const file = element.querySelector('.file-input').files[0],
                dest = element.querySelector('.file-dest').value,
                url  = element.getAttribute('data-policy-url');

            store.dispatch(clearErrors());
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

            store.subscribe(this.render.bind(this));
        }
    }
}

export {View};