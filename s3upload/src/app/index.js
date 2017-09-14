import configureStore from './store';
import {View} from './components';

// by default initHandler inits on '.s3upload', but if passed a custom
// selector in the event data, it will init on that instead.
function initHandler(event) {
    let selector = '.s3upload';

    if (event.detail && event.detail.selector) {
        selector = event.detail.selector;
    }

    const elements = document.querySelectorAll(selector);

    // safari doesn't like forEach on nodeList objects
    for (let i = 0; i < elements.length; i++) {
        // initialise instance for each element
        const element = elements[i];
        const store = configureStore({element});
        const view = new View(element, store);
        view.init();
    }
}

// default global init on document ready
document.addEventListener('DOMContentLoaded', initHandler);

// custom event listener for use in async init
document.addEventListener('s3upload:init', initHandler);