import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

import styles from "./SmallDot.css"

export default class SmallDot extends React.Component {

    render() {
        var color = this.props.color || "green";
        if (color == "green") {
            color = "#17c200";
        } else if (color == "red") {
            color = "#f20000";
        }
        return (
            <div className={styles.connectedIcon} style={{background: color}} />
        );
    }

}