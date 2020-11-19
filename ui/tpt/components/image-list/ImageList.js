import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

import styles from "./ImageList.css"


/**
 * Line Chart Lite with d3.js 
 */
export default class ImageList extends React.Component {

    constructor(props) {
        super(props);

        this._divRef = React.createRef()
        this._canvasRef = React.createRef()
        this._canvasFloat = React.createRef()
        this._chartOptions = typeof(props.options) != "undefined" ? props.options : {};
    }

    componentDidMount() {
        this._chart = new CanvasImageList(this._canvasRef.current, this._canvasFloat.current, this._chartOptions);
        this._chart.on("onSelectedChange", (index) =>{
            this.props.onSelectTimeChange(index)
        });
        this._chart.on("onHoverXChange",(x) => this.props.onHoverXChange(x));
        this._chart.on("onAutoScrollChanged",(autoScroll) => this.props.onAutoScrollChanged(autoScroll));
        this._chart.on("onScrollReachEnd",() => this.props.onScrollReachEnd());
        this._chart.on("onVisualTimeChange",(visualTime) => this.props.onVisualTimeChange(visualTime));
        this._chart.on("zoomed",(transform) => this.props.onTransformChange(transform));
        this._chart.on("onStartMoving", () => this.props.onStartMoving());
        this._chart.setData(this.props.data);
        this._chart.render();
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

    componentDidUpdate(prevProps) {
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
        
        // if(this.props.transform != null) {
        //     this.setTransoform(this.props.transform);
        // }

        // 判断数据是否一样
        let flag = true
        if (JSON.stringify(prevProps.data) !== JSON.stringify(this.props.data)) {
            flag = false
        }
        this._chart.setData(this.props.data, flag);
    
        this._chart.invalidate();
    }

    componentWillUnmount() {
    }

    render() {
        //console.log("LineChart", "render", this.props);
        return (
            <div className={styles.lineChartBox} ref={this._divRef} style={{...this.props.style, height:"100%"}}>
                <canvas id={this.props.id} ref={this._canvasRef} className={styles.lineChartCanvas}></canvas>
                <canvas ref={this._canvasFloat} className={styles.floatChartCanvas}></canvas>
            </div>
        );
    }
}

