import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

import styles from "./Waterfall.css"


/**
 * Waterfall with d3.js 
 */
export default class Waterfall extends React.Component {

    constructor(props) {
        super(props);

        this._divRef = React.createRef()
        this._chartRef = React.createRef()
        this._chartOptions = typeof(props.options) != "undefined" ? props.options : {};
    }

    componentDidMount() {
        this._chart = new WaterFallChart(this._chartRef.current, this._chartOptions);
        this._chart.callback = {
        };
       
        this._chart.setData(this.props.data);
        this._chart.render();
    }

    componentDidUpdate() {
        this._chart.setData(this.props.data);
        this._chart.invalidate();
    }

    componentWillUnmount() {
    }

    render() {
        //console.log("Timeline", "render", this.props);
        return (
            <div className={styles.waterfallChartBox} ref={this._divRef} style={{width: "100%", height: "100%", position: "absolute"}}>
                <div id={this.props.id} ref={this._chartRef}></div>
            </div>
        );
    }
}

Waterfall.propTypes = {
    id: PropTypes.string.isRequired,
    data: PropTypes.array.isRequired,
    options: PropTypes.object.isRequired,
}