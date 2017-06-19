import {removeUpload, getUploadURL, clearErrors, updateProgress} from '../actions';
import {getFilename, getUrl, getError, getUploadProgress} from '../store';
import {raiseEvent} from '../utils';


const View = function(element, store) {
    return {
        render: function(){
            const filename = getFilename(store),
                url = getUrl(store),
                error = getError(store),
                uploadProgress = getUploadProgress(store);

            // if there is a filename, we want to display it and a "remove" link
            if (filename) {
                this.$link.innerHTML = filename;
                this.$link.setAttribute('href', url);

                this.$element.classList.add('link-active');
                this.$element.classList.remove('form-active');
            }
            // if not, let's empty the form and revert to default state
            else {
                this.$element.querySelector('.file-url').value = '';
                this.$element.querySelector('.file-input').value = '';

                this.$element.classList.add('form-active');
                this.$element.classList.remove('link-active');
            }

            // if there's an error, let's display it
            if (error) {
                this.$element.classList.add('has-error');
                this.$element.classList.add('form-active');
                this.$element.classList.remove('link-active');

                this.$element.querySelector('.file-input').value = '';
                this.$element.querySelector('.error').innerHTML = error;

                // dispatch event on the element for external use
                raiseEvent(this.$element, 's3uploads:error', {error});
            }
            // if not, lets empty and hide the error div
            else {
                this.$element.classList.remove('has-error');
                this.$element.querySelector('.error').innerHTML = '';
            }

            if (uploadProgress && uploadProgress < 100) {
                this.$element.classList.add('progress-active');
                this.$bar.style.width = uploadProgress + '%';
            }
            else {
                this.$element.classList.remove('progress-active');
                this.$bar.style.width = '0';
            }
        },

        removeUpload: function(event) {
            store.dispatch(updateProgress());
            store.dispatch(removeUpload());
        },

        getUploadURL: function(event) {
            const file = this.$input.files[0],
                dest = this.$dest.value,
                url  = this.$element.getAttribute('data-policy-url');

            store.dispatch(clearErrors());
            store.dispatch(getUploadURL(file, dest, url, store));
        },

        init: function() {
            // cache all the query selectors
            // $variables represent DOM elements
            this.$element = element;
            this.$url     = element.querySelector('.file-url');
            this.$input   = element.querySelector('.file-input');
            this.$remove  = element.querySelector('.file-remove');
            this.$dest    = element.querySelector('.file-dest');
            this.$link    = element.querySelector('.file-link');
            this.$error   = element.querySelector('.error');
            this.$bar     = element.querySelector('.bar');

            // set initial DOM state
            const status = (this.$url.value === '') ? 'form' : 'link';
            this.$element.className = 's3direct ' + status + '-active'

            // add event listeners
            this.$remove.addEventListener('click', this.removeUpload.bind(this))
            this.$input.addEventListener('change', this.getUploadURL.bind(this))

            // subscribe to the store so that we can reactively render changes
            store.subscribe(this.render.bind(this));
        }
    }
}

export {View};