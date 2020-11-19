import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import classnames from "classnames"
import { Button, ButtonGroup, Spinner, Dropdown, ToggleButton, OverlayTrigger, Tooltip, Modal } from 'react-bootstrap';
// import { FaSearch, FaPlus, FaPlay, FaStop, FaFolderOpen, FaStepForward, FaCloud, FaSearchPlus, FaSearchMinus, FaRegMinusSquare, FaRegPlusSquare, FaLaptopCode  } from 'react-icons/fa';
// import { IconContext } from 'react-icons';
import styles from "./app.css";

/**
 * ToolBar
 */
export default class ToolBar extends React.Component {

    constructor(props) {
        super(props);

    }

    componentDidMount() {
    }

    componentWillUnmount() {
    }

    render() {
        // console.log("Toolbar", "render", "deltaChecked", this.props.deltaChecked);
        return (
            <div className={classnames(styles.toolBar, styles.topToolBar)}>
                <div className={styles.leftBtns}>
                    &nbsp;&nbsp;&nbsp;<span>TPT Memory Report : {this.props.reportName ? this.props.reportName : "No report file have been loaded"} </span>
                </div>

                <div className={styles.centerBtns}>
                    {this.props.loading || this.props.centerLoading ? (
                        <Spinner
                            as="span"
                            animation="border"
                            size="sm"
                            role="status"
                            aria-hidden="true"
                            />
                        ) : (
                            <div></div>
                        )}
                </div>

                <div className={styles.rightBtns} style={{marginRight: "10px"}}>
                    <div style={{display: "flex", height: "100%", alignItems: "center"}}>
                        {this.props.searchResult && (<span>{this.props.searchResult}</span>)}
                        <input type="text" style={{margin: "1px", marginRight: "5px", marginLeft: "5px"}} value={this.props.searchVal} onChange={this.props.onSearchChange}/>
                        <div style={{display: "flex", height: "100%", font: "icon"}} onClick={this.props.onSearchClick}>
                            &#x1F50D;
                        </div>
                    </div>
                    &nbsp;&nbsp;&nbsp;&nbsp;

                    <div style={{display: "flex"}}>
                        <pre style={{margin: "1px", marginRight: "5px", marginLeft: "5px"}}>delta mode</pre>
                        <input style={{margin: "1px"}} type="checkbox" onChange={this.props.handleDeltaCheck} checked={this.props.deltaChecked}/>
                    </div>
                    &nbsp;&nbsp;&nbsp;&nbsp;

                    <div style={{display: "flex"}}>
                        <pre style={{margin: "1px", marginRight: "5px", marginLeft: "5px"}}>diff mode</pre>
                        <input style={{margin: "1px"}} type="checkbox" onChange={this.props.handleCheck} checked={this.props.checked}/>
                    </div>

                </div>
            </div>
        );
    }
}

ToolBar.propTypes = {
};