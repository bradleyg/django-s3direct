import configureStore from './store';
import {View} from './components';

document.addEventListener('DOMContentLoaded', function(e) {
    const elements = document.querySelectorAll('.s3uploads');

    elements.forEach(function(element) {
        // initialise instance for each element
        const store = configureStore({element});
        const view = new View(element, store);
        view.init();
    });
});