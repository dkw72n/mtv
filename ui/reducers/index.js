import { combineReducers } from 'redux';

import line from "./line.reducer";

export default combineReducers({
    line: line,
});
