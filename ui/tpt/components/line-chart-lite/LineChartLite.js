import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

import styles from "./LineChartList.css"


/**
 * Line Chart Lite with d3.js 
 */
export default class LineChartLite extends React.Component {

    constructor(props) {
        super(props);

        this._divRef = React.createRef()
        this._canvasRef = React.createRef()
        this._chartOptions = typeof(props.options) != "undefined" ? props.options : {};
    }

    componentDidMount() {
        this._chart = new CanvasLineLiteChart(this._canvasRef.current, this._chartOptions);
        this._chart.on("onItemClick", (index) => this.props.onItemClick(index));
        console.log("LineChartLite",this.props.data);
        this._chart.setData(this.props.data);
        this._chart.render();
    }

    onResize() {
        this._chart.onResize();
    }

    setSelectedIndex(selectedIndex) {
        this._chart.setSelectedIndex(selectedIndex);
    }

    componentDidUpdate() {
        this._chart.setData(this.props.data);
        this._chart.invalidate();
    }

    componentWillUnmount() {
    }

    render() {
        //console.log("LineChart", "render", this.props);
        return (
            <div className={styles.lineChartBox} ref={this._divRef} style={{...this.props.style, height:"100%"}}>
                <canvas id={this.props.id} ref={this._canvasRef} className={styles.lineChartCanvas}></canvas>
            </div>
        );
    }
}

LineChartLite.propTypes = {
    id: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    options: PropTypes.object.isRequired,
    onItemClick: PropTypes.func.isRequired,
}