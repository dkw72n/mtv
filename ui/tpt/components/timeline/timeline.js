import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

import styles from "./TimeLine.css"


/**
 * Timeline with d3.js 
 */
export default class Timeline extends React.Component {

    constructor(props) {
        super(props);

        this._divRef = React.createRef()
        this._canvasRef = React.createRef()
        this._chartOptions = typeof(props.options) != "undefined" ? props.options : {};
    }

    componentDidMount() {
        this._chart = new TimelineChart(this._canvasRef.current, this._chartOptions);
        this._chart.callback = {
            onEventClicked: (event) => this.props.onEventClicked(event),
            onBrushChanged: (start, end) => this.props.onBrushChanged(start, end),
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
            <div className={styles.timelineChartBox} ref={this._divRef}>
                <canvas id={this.props.id} ref={this._canvasRef} className={styles.lineChartCanvas}></canvas>
            </div>
        );
    }
}

Timeline.propTypes = {
    id: PropTypes.string.isRequired,
    data: PropTypes.array.isRequired,
    options: PropTypes.object.isRequired,

    onEventClicked: PropTypes.func.isRequired,
    onBrushChanged: PropTypes.func.isRequired
}