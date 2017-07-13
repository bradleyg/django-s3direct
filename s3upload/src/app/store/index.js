import { createStore } from 'redux';
import reducers from '../reducers';

const { devToolsExtension } = window;

export default function configureStore (initialState) {
    return createStore(
        reducers,
        initialState,
        devToolsExtension && devToolsExtension()
    );
}

export * from './connect';