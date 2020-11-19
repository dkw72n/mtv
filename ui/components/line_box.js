import React from "react"
import TimeFlameGraphComponent from "../tpt/components/time-flame-graph/TimeFlameGraph"
import LineChart from "../tpt/components/line-chart/LineChart"
import seedrandom from 'seedrandom';
import { FunctionColors, ENV } from "../constants"
import { Button, ButtonGroup, Spinner, Dropdown, ToggleButton, OverlayTrigger, Tooltip, Modal, Form, Row, Col } from 'react-bootstrap';
import styles from "./app.css";
import ToolBar from "./toolbar";

export default class LineBox extends React.Component {

    constructor(props) {
        super(props)
    }

    render() {
        return (
            <div style={{ width: "100%" }}>
                <LineChart id="chart_id"
                    selectX={this.props.selectX}
                    offset={this.props.offset}
                    data={this.props.lineData}
                    autoScroll={false}
                    options={this.props.options}
                    showScrollBar={true}
                    onSelectChanged={(x, index) => this.props.onSelectChanged(x, index)}
                    onOffsetChanged={(offset) => this.props.onOffsetChanged(offset)}
                    onAutoScrollChanged={(autoScroll) => this.props.onAutoScrollChanged(autoScroll)}
                    onSelectIndexChanged={(selectIndex) => this.props.onSelectIndexChanged(selectIndex)}
                    onLabelClicked={(label) => this.props.onLabelClicked(label)}
                    onStartMoving={() => this.props.onStartMoving()}
                    onScrollReachEnd={() => this.props.onScrollReachEnd()}
                />
            </div>
        )
    }
}



