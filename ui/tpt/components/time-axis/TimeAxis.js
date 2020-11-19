import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

import styles from "./TimeAxis.css"


/**
 * Line Chart Lite with d3.js 
 */
export default class TimeAxis extends React.Component {

    constructor(props) {
        super(props);

        this._divRef = React.createRef()
        this._canvasRef = React.createRef()
        this._scrollBarRef = React.createRef()
        this._chartOptions = typeof(props.options) != "undefined" ? props.options : {};
    }

    componentDidMount() {
        this._chart = new CanvasTimeAxis(this._canvasRef.current, this._chartOptions);
        if (this.props.showScrollBar) {
            this._chart.setScrollBarElement(this._scrollBarRef.current);
        }
        this._chart.on("onSelectedChange", (index) =>{
            this.props.onSelectTimeChange(index)
        });
        this._chart.callback={
            //onOffsetChanged: (offset) => this.props.onOffsetChanged(offset),
            onScroll: ()=>this.props.onScrollBarScroll(),
            onOffsetChanged: (offset) => this.props.onOffsetChanged(offset),
            onAutoScrollChanged: (autoScroll) => this.props.onAutoScrollChanged(autoScroll),
        }
        this._chart.setOffset(this.props.offset, false);
        this._chart.setAutoScroll(this.props.autoScroll);
        this._chart.render();
    }

    componentDidUpdate() {
        this._chart.setOffset(this.props.offset, false);
        this._chart.setAutoScroll(this.props.autoScroll);
        this._chart.setVisualTime(this.props.visualTime)
    }

    onResize() {
        this._chart.onResize();
    }


    // componentDidUpdate() {
    //     if(this.props.autoScroll != null) {
    //         this._chart.setAutoScroll(this.props.autoScroll);
    //     }
    //     if(this.props.visualTime != null) {
    //         this._chart.setVisualTime(this.props.visualTime)
    //     }
    //     if(this.props.hoverX != null) {
    //         this._chart.setHoverX(this.props.hoverX);
    //     }
    //     if(this.props.selectTime != null) {
    //         this._chart.setSelectTime(this.props.selectTime);
    //     }
        
    //     // if(this.props.transform != null) {
    //     //     this.setTransoform(this.props.transform);
    //     // }
    //     this._chart.setData(this.props.data);
        
    //     this._chart.invalidate();
    // }

    componentWillUnmount() {
    }

    render() {
        //console.log("LineChart", "render", this.props);
        return (
            <div className={styles.lineChartBox} ref={this._divRef} style={{...this.props.style, height:"100%"}}>
                <div className={styles.canvasBox}>
                    <canvas id={this.props.id} ref={this._canvasRef} className={styles.lineChartCanvas}></canvas>
                </div>
                { this.props.showScrollBar && (
                    <div ref={this._scrollBarRef} className={styles.lineChartScrollbar}></div>
                )}
            </div>
        );
    }
}
