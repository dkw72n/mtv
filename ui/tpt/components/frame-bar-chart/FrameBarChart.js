import React from 'react';
import PropTypes from 'prop-types'

/**
 * FrameBarChart with d3.js 
 */
export default class FrameBarChartComponent extends React.Component {

    constructor(props) {
        super(props);

        this._divRef = React.createRef()
        this._chartOptions = typeof(props.options) != "undefined" ? props.options : {};
    }

    onResize() {
        this._chart.onResize();
    }

    reset() {
        this._chart.reset();
    }

    update() {
        this._chart.notifyDataSetChanged();
        this._chart.invalidate();
    }

    setSelectedIndex(selectedIndex) {
        this._chart.setSelectedIndex(selectedIndex);
        this._chart.invalidate();
    }

    componentDidMount() {
        this._chart = new FrameBarChart(this._divRef.current, this.props.dataProvider, this._chartOptions);
        this._chart.on("click", (entry) => {
            console.log("click", entry);
            if (this.props.itemClick) {
                this.props.itemClick(entry);
            }
        });
        this._chart.render();
    }

    componentDidUpdate() {
        this.update();
    }

    componentWillUnmount() {
    }

    render() {
        return (
            <div id="chart" ref={this._divRef}></div>
        );
    }
}

FrameBarChartComponent.propTypes = {
    dataProvider: PropTypes.object.isRequired,
    options: PropTypes.object.isRequired,
    itemClick: PropTypes.func.isRequired,
}