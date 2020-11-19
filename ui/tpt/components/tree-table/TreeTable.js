import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import MovementHalper from "../table-view/MovementHelper"
import {HORIZONTAL} from '../table-view/MovementHelper'
import styles from "./TreeTable.css"
import { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } from 'constants';

function walkTree(node, func, comparetor = null) {
    func(node);
    if (node.children) {
        if (comparetor) node.children.sort(comparetor);
        for (let i = 0; i < node.children.length; i++) {
            walkTree(node.children[i], func, comparetor);
        }
    }
}

function formatNumber(number) {
    if (typeof(number) != "undefined") {
        return number.toFixed(2);
    } else {
        return "NaN";
    }
}

function formatPercent(number) {
    if (typeof(number) != "undefined") {
        return (number * 100).toFixed(2) + "%";
    } else {
        return "NaN%";
    }
}

export const Columns = {
    Overview:   0,
    Total:      1,
    Self:       2,
    Calls:      3,
    TimeMs:     4,
    SelfMs:     5,
}

/**
 * Tree Table View
 */
export default class TreeTable extends React.Component {

    constructor(props) {
        super(props);

        this.options = Object.assign({
            selfValue: true,
            defaultCollapsed: true,
        }, this.props.options);

        this.state = {
            selectId : -1
        };

        this.initData(this.props.data, this.props.getChildren);
        this.reappraiseNode();


        this.ref = React.createRef();
        this.lineRefs = [];
        this.mouseClickLineIndex = -1;
        this.mimColWidth = 20;
        this.onResize =  this.onResize.bind(this);
        this.width = 0;
        this.isShowLine = false;
        this.colWidths = null;

    }
    componentDidMount() {
        this.width = this.ref.current.parentNode.getBoundingClientRect().right - this.ref.current.parentNode.getBoundingClientRect().left
        this.colWidths = this.computeColsWidth(this.width);
        this.isShowLine = true;
        this.notifyDataSetChanged();
        this.moveHandler = new MovementHalper({
            startMove: () => this.onResizerStartMove(),
            onMove : (x, y, diffX, diffY) => { this.onResizerMoving(diffX, diffY) },
            endMove: () => this.onResizerEndMove(),
            onDown: (target) => this.onDown(target)
        },null,styles.dropLine,HORIZONTAL);
        this.onMouseDown = this.moveHandler.onMouseDown;
        this.onMouseMove = this.moveHandler.onMouseMove;
        this.omMouseUp = this.moveHandler.onMouseUp;
        this.ref.current.addEventListener("mousedown",this.onMouseDown,true)
        window.addEventListener('mouseup', this.omMouseUp,true);
        this.ref.current.addEventListener('mousemove', this.onMouseMove,true);
        window.addEventListener('resize',this.onResize);
    }

    componentWillUnmount(){
        this.ref.current.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        this.ref.current.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('resize',this.onResize);
    }

    _getHeaderThDoms() {
        let thArr = this.ref.current.getElementsByTagName("th");
        return thArr;
    }
    
    computeColsWidth(width) {
        let thArr = this._getHeaderThDoms();
        if (thArr == null) {
            return;
        }
         /**获取各个列的宽度 */
        var widths = [];
        for (let i = 0; i < thArr.length; i++) {
            let width = thArr[i].getBoundingClientRect().right - thArr[i].getBoundingClientRect().left
            widths.push(width);
        }

        /**如果参数中给定的宽度总和已经超过的父控件的大小，那么等比缩小每个列 */
        // console.log("tableView","缩小前",widths)
        let allWidthforCol = 0;
        widths.map((width,index) =>{
            allWidthforCol += width
        })
        if (allWidthforCol > width) {
            let scalePercent = width / allWidthforCol;
            widths = widths.map((width,index) =>{
                return width * scalePercent;
            })
        }

  

        /**如果有的列宽度小于最小宽度，调整各个列的宽度 */
        for (let i = 0; i < widths.length; i++) {
            let item = widths[i];
            if (item < this.mimColWidth) {
                let completion = this.mimColWidth - item;
                for (let j = widths.length -1; j >= 0; j--) {
                    if (widths[j] >= this.mimColWidth + completion) {
                        widths[j] = widths[j] - completion;
                        widths[i] = this.mimColWidth;
                        j = -1;
                    }
                }
            }
        }
     
    
        return widths;
    }

    onResize() {
        /**获取父控件宽度 */
        let newWidth = this.ref.current.parentNode.getBoundingClientRect().right - this.ref.current.parentNode.getBoundingClientRect().left
        if (newWidth == 0) {
            return;
        }
        let newWidths = this.computeColsWidth(newWidth)
        this.Width = newWidth;
        this.colWidths = newWidths;
        this.notifyDataSetChanged();
    }

    onDown(target) {
        for (let index = 0; index < this.lineRefs.length; index ++) {
            if (target == this.lineRefs[index].current) {
                    this.mouseClickLineIndex = index;
            }
        }
    }

    onResizerStartMove(){
    }

    onResizerMoving(diffX, diffY) {
      
        let widths =this.colWidths;
        // 最大左滑距离
        let maxLeftDrop = 0 - (widths[this.mouseClickLineIndex] - this.mimColWidth)
        // 最大右滑距离
        let maxRigthDrop = widths[widths.length - 1] - this.mimColWidth;
        // 真实滑动距离
        let realdiffy = 0;
        if(diffX < maxLeftDrop) {
            realdiffy = maxLeftDrop;
        } else if (diffX > maxRigthDrop){
            realdiffy = maxRigthDrop;
        } else {
            realdiffy = diffX;
        }
        widths[this.mouseClickLineIndex] = widths[this.mouseClickLineIndex] + realdiffy
        widths[widths.length -1] = widths[widths.length - 1] - realdiffy;
        this.colWidths = widths;
        this.notifyDataSetChanged();
    }

    onResizerEndMove(){
        this.mouseClickLineIndex = -1;
    }






    initData(data, getChildren) {
        this.root = d3.hierarchy(data, getChildren);
        console.log("root",this.root)
    }

    reappraiseNode() {
        const root = this.root;

        var id = 0;
        var item = root.data
        item.id = id;
        item.hide = false;
        item.isCollapsed = false;
        item.selfValue = 0;
        item.selfPercent = 0;
        item.valuePercent = 1.0;
        item.calls = 1;
        var node, children, child, i, j, childrenValue, childValue;
        var stack = [];
        const compoundValue = !this.options.selfValue;

        var totalValue = 0;
        for (let i = 0; i < root.children.length; i++) {
            totalValue += this.props.getValue(root.children[i].data);
        }
        root.value = totalValue;

        stack.push(root)
        while ((node = stack.pop())) {
            children = node.children;
            if (children && (i = children.length)) {
                childrenValue = 0;
                while (i--) {
                    child = children[i];
                    item = child.data;
                    childValue = this.props.getValue(item);
                    child.value = childValue;
                    item.valuePercent = child.value / (totalValue * 1.0);
                    item.selfValue = 0;
                    item.selfPercent = 0;
                    childrenValue += childValue;

                    item.id = ++id;
                    item.hide = child.depth > 1 ? this.options.defaultCollapsed : false;
                    item.isCollapsed = this.options.defaultCollapsed;

                    item.calls = 1;

                    stack.push(child);
                }
                node.data.selfValue = node.value - childrenValue;
                node.data.selfPercent = node.data.selfValue / (totalValue * 1.0);
            }
        }
       
    }

    onItemClick(node, e) {
        console.log("onItemClick", node.data.id);
        //this.setState({selectId: node.data.id});
    }

    onItemCollapsedBtnClick(node, e) {
        console.debug("onItemClick", node);
        node.data.isCollapsed = !node.data.isCollapsed;

        if (node.data.isCollapsed) {
            walkTree(node, (child) => {
                if (child != node) {
                    child.data.hide = true;
                    child.data.isCollapsed = true;
                }
            })
        } else if (node.children != null) {
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                child.data.hide = false;
            }
        }

        this.notifyDataSetChanged();
    }

    notifyDataSetChanged() {
        this.forceUpdate();
    }

    renderRow(node) {

        const data = node.data;
      
        
        console.debug(node.data.name, ": isCollapsed", data.isCollapsed, "hide", data.hide, "node", node);
        if (data.hide) {
            return;
        }

        const hasChild = node.children && node.children.length > 0;
        const isCollapsed = node.data.isCollapsed;
        const onItemCollapsedBtnClick = this.onItemCollapsedBtnClick.bind(this, node);
        const onItemClick = this.onItemClick.bind(this, node);
        const onItemDoubleClick = this.onItemCollapsedBtnClick.bind(this, node);

        var indent = [];
        for (var i = 0; i < node.depth; i++) {
            indent.push((<b key={i} />));
        }

        // console.log("this.state.selectId == data.id", this.state.selectId, data.id);

        const activeClassName = styles.active;
        return (
            <tr key={data.id} onClick={onItemClick} onDoubleClick={onItemDoubleClick} className={classNames({[activeClassName]: this.state.selectId == data.id})}>
                <td style={this.props.colStyle}>
                    {indent}
                    {hasChild ? 
                        isCollapsed ? (
                            <img src="./res/img/ic_arrow_right.png" width="16" height="16" alt="arrow right" onClick={onItemCollapsedBtnClick} />
                        ) : (
                            <img src="./res/img/ic_arrow_down.png" width="16" height="16" alt="arrow down" onClick={onItemCollapsedBtnClick} />
                        )
                     : (
                        <span style={{display: "inline-block", width: "16px", height: "16px"}} />
                    )}
                    lv-{node.depth}
                    {data.name}
                </td>
                <td style={this.props.colStyle}>{formatPercent(data.valuePercent)}</td>
                <td style={this.props.colStyle}>{formatPercent(data.selfPercent)}</td>
                <td style={this.props.colStyle}>{data.calls}</td>
                <td style={this.props.colStyle}>{formatNumber(node.value)}</td>
                <td style={this.props.colStyle}>{formatNumber(data.selfValue)}</td>
            </tr>
        );
    }

    sortBy(node) {
        switch (this.props.sortBy) {
            case Columns.Total:
                return node.data.valuePercent;
            case Columns.Self:
                return node.data.selfPercent;
            case Columns.Calls:
                return node.data.calls;
            case Columns.TimeMs:
                return node.value;
            case Columns.SelfMs:
                return node.data.selfValue;
            default:
                return node.value;
        }
    }

    render() {

        const Rows = [];

        walkTree(this.root, (node) => {
            Rows.push(this.renderRow(node));
        }, (node1, node2) => {
            const v1 = this.sortBy(node1);
            const v2 = this.sortBy(node2);
            return this.props.descending ? v2 - v1 : v1 - v2;
        });


        /**创建 col 数组，用于控制每一列宽度 */
        var Colgroups = [];
        if (this.colWidths != null) {
            var Colgroups = this.colWidths.map((data,index) =>{
                let style = {width:'' + data + "px"}
                return <col key={index} style={style}></col>
            })
        } else {
            for (let i = 0; i < 6; i++) {
                let style = null;
                if (i == 0) {
                    style = {width:'auto'}
                }else {
                    style = {width:'10%'}
                }
                Colgroups.push(<col style={style}></col>)
            }
        }

        var dropLines = [];
        if (this.isShowLine) {
            let leftMarget = -3;
            let thArr = this._getHeaderThDoms();
            for (let index = 0; index < thArr.length -1; index++ ) {
                if(this.lineRefs[index] == null) {
                    let ref = React.createRef();
                    this.lineRefs.push(ref);
                }
                let style = null;
                if(this.colWidths != null && this.colWidths[index] != null) {
                    let marget = this.colWidths[index]
                    leftMarget = leftMarget + marget;
                    let textMarget = '' + leftMarget + 'px'
                    style = {
                        cursor:'col-resize',
                        left:textMarget
                    }
                }
                let line = <div ref={this.lineRefs[index]} className={styles.dropLine} style={style}></div>
                dropLines.push(line);
            }
        }


        const OrderIcon = (
            (this.props.descending) ? (
                <img src="./res/img/ic_arrow_down.png" width="16" height="16" alt="descending" />
            ) : (
                <img src="./res/img/ic_arrow_top.png" width="16" height="16" alt="ascending" />
            )
        );
        const sortBy = this.props.sortBy;
        return (
           
            <div ref={this.ref}>
                <table className={styles.treeTable}>
                    <colgroup>
                        {Colgroups}
                    </colgroup>
                    <thead>
                        <tr>
                            <th style={this.props.headStyle}  onClick={e => this.props.onHeadClick(Columns.Overview)}>Overview</th>
                            <th style={this.props.headStyle}  onClick={e => this.props.onHeadClick(Columns.Total)}>Total{sortBy == Columns.Total ? OrderIcon : ""}</th>
                            <th style={this.props.headStyle}  onClick={e => this.props.onHeadClick(Columns.Self)}>Self{sortBy == Columns.Self ? OrderIcon : ""}</th>
                            <th style={this.props.headStyle}  onClick={e => this.props.onHeadClick(Columns.Calls)}>Calls{sortBy == Columns.Calls ? OrderIcon : ""}</th>
                            <th style={this.props.headStyle}  onClick={e => this.props.onHeadClick(Columns.TimeMs)}>Time ms{sortBy == Columns.TimeMs ? OrderIcon : ""}</th>
                            <th style={this.props.headStyle}  onClick={e => this.props.onHeadClick(Columns.SelfMs)}>Self ms{sortBy == Columns.SelfMs ? OrderIcon : ""}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Rows}
                    </tbody>
                </table>
                {dropLines}
            </div>
          
            
    );
    }
}


TreeTable.propTypes = {
    options: PropTypes.object,
    descending: PropTypes.bool,
    sortBy: PropTypes.number,
    data: PropTypes.object,
    getValue: PropTypes.func,
    getChildren: PropTypes.func,
    onHeadClick: PropTypes.func,
}