import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import MemtraceDemo from "../containers/MemtraceDemo.container"

/**
 * App
 */
export default class App extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        // console.log("App", "render", this.props);
        return (
            <div style={{width: "100%", height: "100%"}}>
                <MemtraceDemo />
            </div>
        );
    }

}