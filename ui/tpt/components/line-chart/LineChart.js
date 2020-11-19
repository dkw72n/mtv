import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

import styles from "./LineChart.css"


/**
 * Line Chart with d3.js 
 */
export default class LineChart extends React.Component {

    constructor(props) {
        super(props);

        this._divRef = React.createRef()
        this._canvasRef = React.createRef()
        this._scrollBarRef = React.createRef()
        this._chartOptions = typeof(props.options) != "undefined" ? props.options : {};
    }

    reset() {
        this._chart.reset();
    }

    componentDidMount() {
        this._chart = new CanvasLineChart(this._canvasRef.current, this._chartOptions);
        if (this.props.showScrollBar) {
            this._chart.setScrollBarElement(this._scrollBarRef.current);
        }
        this._chart.callback = {
            onSelectChanged: (x, index) => this.props.onSelectChanged(x, index),
            onOffsetChanged: (offset) => this.props.onOffsetChanged(offset),
            onSelectIndexChanged: (selectIndex) => this.props.onSelectIndexChanged(selectIndex),
            onAutoScrollChanged: (autoScroll) => this.props.onAutoScrollChanged(autoScroll),
            onLabelClicked: (label) => this.props.onLabelClicked(label),
            onStartMoving: () => this.props.onStartMoving(),
            onScrollReachEnd: () => this.props.onScrollReachEnd(),
        };
       
        this._chart.setSelectX(this.props.selectX);
        this._chart.setAutoScroll(this.props.autoScroll);
        this._chart.setOffset(this.props.offset, false);
        this._chart.setData(this.props.data);
        this._chart.render();
    }

    componentDidUpdate() {
        this._chart.setSelectX(this.props.selectX);
        this._chart.setAutoScroll(this.props.autoScroll);
        this._chart.setOffset(this.props.offset, false);
        this._chart.setData(this.props.data);
        this._chart.invalidate();
    }

    componentWillUnmount() {
    }

    render() {
        //console.log("LineChart", "render", this.props);
        return (
            <div className={styles.lineChartBox} ref={this._divRef}>
                <canvas id={this.props.id} ref={this._canvasRef} className={styles.lineChartCanvas}></canvas>
                { this.props.showScrollBar && (
                    <div ref={this._scrollBarRef} className={styles.lineChartScrollbar}></div>
                )}
            </div>
        );
    }
}

LineChart.propTypes = {
    id: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    options: PropTypes.object.isRequired,
    selectX:  PropTypes.number.isRequired,
    autoScroll:  PropTypes.bool.isRequired,
    offset:  PropTypes.number.isRequired,
    onSelectChanged: PropTypes.func.isRequired,
    onOffsetChanged: PropTypes.func.isRequired,
    onSelectIndexChanged: PropTypes.func.isRequired,
    onLabelClicked: PropTypes.func.isRequired,
    onStartMoving: PropTypes.func.isRequired,
    onScrollReachEnd: PropTypes.func.isRequired
}