import configureStore from './store';
import {view} from './components';


// var addHandlers = function(el) {
//     var url    = el.querySelector('.file-url'),
//         input  = el.querySelector('.file-input'),
//         remove = el.querySelector('.file-remove'),
//         status = (url.value === '') ? 'form' : 'link'

//     el.className = 's3direct ' + status + '-active'

//     remove.addEventListener('click', removeUpload, false)
//     input.addEventListener('change', getUploadURL, false)
// }


document.addEventListener('DOMContentLoaded', function(e) {
    const elements = document.querySelectorAll('.s3direct');

    elements.forEach(function(element) {
        // initialise instance for each element
        const store = configureStore();
        const view = new View(element, store);
        view.init();
    });
})

// document.addEventListener('DOMNodeInserted', function(e){
//     if(e.target.tagName) {
//         var el = e.target.querySelectorAll('.s3direct');
//         [].forEach.call(el, function (element, index, array) {
//     addHandlers(element);
//     });
//     }
// })
