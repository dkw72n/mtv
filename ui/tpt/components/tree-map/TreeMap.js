import React from 'react';
import PropTypes from 'prop-types'

/**
 * TreeMap with d3.js 
 */
export default class TreeMap extends React.Component {

    constructor(props) {
        super(props);
        this.search = this.search.bind(this)
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

    search(finder) {
        if (this._chart != null) {
            this._chart.searchNode(finder);
        }
    }

    componentDidMount() {
        this._chart = new TreeMapChart(this._divRef.current, this.props.dataProvider, this._chartOptions, this.props.getValue, this.props.getChildren);
        this._chart.on("onItemClick", (entry) => {
            console.log("onItemClick", entry);
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

TreeMap.propTypes = {
    dataProvider: PropTypes.object.isRequired,
    options: PropTypes.object.isRequired,
}