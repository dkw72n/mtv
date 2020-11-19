import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux'
import { createStore, applyMiddleware } from 'redux'
import thunk from 'redux-thunk';

import App from "./components/app"
import rootReducer from './reducers'

// console.log("ui.js", window.console);
window.console.debug = (...args) => {}
//window.console.info = (...args) => {}
//window.console.log = (...args) => {}


export const store = createStore(
    rootReducer,
);

ReactDOM.render(
    <Provider store={store}>
        <App />
    </Provider>
, document.querySelector('#container'));