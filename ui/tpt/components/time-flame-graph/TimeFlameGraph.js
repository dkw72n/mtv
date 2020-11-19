import React from 'react';
import PropTypes from 'prop-types'

/**
 * TimeFlameGraphComponent with d3.js 
 */
export default class TimeFlameGraphComponent extends React.Component {

    constructor(props) {
        super(props);

        this._divRef = React.createRef()
        this._chartOptions = typeof(props.options) != "undefined" ? props.options : {};
    }

    search(keyword) {
        return this._chart.search(keyword);
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

    selectItem(entryIndex) {
        this._chart.selectItem(entryIndex);
    }

    componentDidMount() {
        this._chart = new TimeFlameGraph(this._divRef.current, this.props.dataProvider, this._chartOptions);
        this._chart.on("highlight", (entry) => {
            // console.log("highlight", entry);
            if (this.props.itemHighlight){
              this.props.itemHighlight(entry);
            }
        });
        this._chart.on("click", (entry) => {
            // console.log("click", entry);
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

TimeFlameGraphComponent.propTypes = {
    dataProvider: PropTypes.object.isRequired,
    options: PropTypes.object.isRequired,
    itemClick: PropTypes.func.isRequired,
}