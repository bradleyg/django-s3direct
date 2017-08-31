import configureStore from './store';
import {View} from './components';

document.addEventListener('DOMContentLoaded', function(e) {
    const elements = document.querySelectorAll('.s3upload');

    // safari doesn't like forEach on nodeList objects
    for (let i = 0; i < elements.length; i++) {
        // initialise instance for each element
        const element = elements[i];
        const store = configureStore({element});
        const view = new View(element, store);
        view.init();
    }
});