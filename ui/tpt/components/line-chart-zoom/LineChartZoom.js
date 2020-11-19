import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

import styles from "./LineChartZoom.css"


/**
 * Line Chart Lite with d3.js 
 */
export default class LineChartZoom extends React.Component {

    constructor(props) {
        super(props);

        this._divRef = React.createRef()
        this._canvasRef = React.createRef()
        this._chartOptions = typeof(props.options) != "undefined" ? props.options : {};
    }

    componentDidMount() {
        this._chart = new CanvasLineChartZoom(this._canvasRef.current, this._chartOptions);
        this._chart.on("onSelectedChange", (index) =>{
            this.props.onSelectTimeChange(index)
        });
        this._chart.on("onHoverXChange",(x) => this.props.onHoverXChange(x));
        this._chart.on("onAutoScrollChanged",(autoScroll) => this.props.onAutoScrollChanged(autoScroll));
        this._chart.on("onScrollReachEnd",() => this.props.onScrollReachEnd());
        this._chart.on("onVisualTimeChange",(visualTime) => this.props.onVisualTimeChange(visualTime));
        this._chart.on("zoomed",(transform) => this.props.onTransformChange(transform));
        this._chart.on("onStartMoving", () => this.props.onStartMoving());
        this._chart.on("onAddNote", (time) => this.props.onAddNote(time));
        this._chart.on("onRemoveNote", (time) => this.props.onRemoveNote(time));
        this._chart.on("onMoveAreaChange", (time) => this.props.onMoveAreaChange(time))
        this._chart.on("onDiffLineChange", (time) => this.props.onDiffLineChange(time))
        this._chart.setData(this.props.data);
        this._chart.render();
        this._height = this._divRef.current.getBoundingClientRect().height;
    }

    onResize() {
        this._chart.onResize();
    }

    setTransoform(transform) {
        this._chart.setTransoform(transform);
    }

    zoomIn() {
        this._chart.zoomIn();
    }

    zoomOut() {
        this._chart.zoomOut();
    }

    resetZoom() {
        this._chart.resetZoom();
    }


    componentDidUpdate() {
        if(this.props.autoScroll != null) {
            this._chart.setAutoScroll(this.props.autoScroll);
        }
        if(this.props.visualTime != null) {
            this._chart.setVisualTime(this.props.visualTime)
        }
        if(this.props.hoverX != null) {
            this._chart.setHoverX(this.props.hoverX);
        }
        if(this.props.selectTime != null) {
            this._chart.setSelectTime(this.props.selectTime);
        }
        if (this.props.maxTime != null) {
            this._chart.setMaxTime(this.props.maxTime);
        }
        if (this.props.notes != null) {
            this._chart.setNoteList(this.props.notes)
        }
        if (this.props.diffChecked != null) {
            this._chart.setDiffCheck(this.props.diffChecked)
        }
        // if(this.props.transform != null) {
        //     this.setTransoform(this.props.transform);
        // }
        this._chart.setData(this.props.data);
        if(this._height == this._divRef.current.getBoundingClientRect().height){
            this._chart.invalidate();
        } else{
            this._chart.onResize();
            this._height = this._divRef.current.getBoundingClientRect().height;
        }
    }

    componentWillUnmount() {
    }

    render() {
        //console.log("LineChart", "render", this.props);
        return (
            <div className={styles.lineChartBox} ref={this._divRef} style={{height:"100%", ...this.props.style}}>
                <canvas id={this.props.id} ref={this._canvasRef} className={styles.lineChartCanvas}></canvas>
            </div>
        );
    }
}

LineChartZoom.propTypes = {
    id: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
}