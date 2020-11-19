import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import MovementHalper from './MovementHelper'
import {HORIZONTAL} from './MovementHelper'
import Styles from "./TableView.css"



/**
 * Table View
 */
export default class TableView extends React.Component {

    constructor(props) {
        super(props);

        this.options = Object.assign({
            endless: false,
            pager: null,
        }, this.props.options);
        // this.data = this.props.data.data ? this.props.data.data : [];

        this.state = {
            descending: true,
            sortBy: this.props.sortBy ? this.props.sortBy : -1,
            pageNumber: 0
        };
        this.ref = React.createRef();
        this.tableViewBodyBoxRef = React.createRef();
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
        },null,Styles.dropLine,HORIZONTAL);
        this.onMouseDown = this.moveHandler.onMouseDown;
        this.onMouseMove = this.moveHandler.onMouseMove;
        this.omMouseUp = this.moveHandler.onMouseUp;
        this.ref.current.addEventListener("mousedown",this.onMouseDown,true)
        window.addEventListener('mouseup', this.omMouseUp,true);
        this.ref.current.addEventListener('mousemove', this.onMouseMove,true);
        window.addEventListener('resize',this.onResize);

        this.onScroll = this.onScroll.bind(this);
        this.tableViewBodyBoxRef.current.addEventListener("scroll", this.onScroll);
    }
    
    componentWillUnmount(){
        this.ref.current.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        this.ref.current.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('resize',this.onResize);

        this.tableViewBodyBoxRef.current.removeEventListener("scroll", this.onScroll);
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

    onScroll(e) {
        const scrollTop = e.target.scrollTop,
              scrollHeight = e.target.scrollHeight,
              height = e.target.clientHeight;

        if (this.options.endless && this._hasPager() && (scrollTop + height > scrollHeight - 100 /* 提前量做预加载 */)) {
            this._loadNextPage();
        }
    }

    _hasPager() {
        return typeof(this.props.pageSize) != "undefined";
    }

    _loadNextPage() {
        const nextPageNumber = this.getPageNumber() + 1;
        this.setPageNumber(nextPageNumber);
    }

    getPageNumber() {
        if (this.props.pageNumber && onPageNumberChanged) {
            return this.props.pageNumber;
        } else {
            return this.state.pageNumber;
        }
    }

    setPageNumber(pageNumber) {
        if (!this._hasPager()) {
            return;
        }

        const maxPageNumber = this.props.data && this.props.data.data 
                            ? Math.ceil(this.props.data.data.length / this.props.pageSize) - 1 
                            : 0; 
        if (pageNumber < 0) {
            pageNumber = 0;
        } else if (pageNumber > maxPageNumber) {
            pageNumber = maxPageNumber;
        }

        if (this.props.pageNumber && onPageNumberChanged) {
            this.props.onPageNumberChanged(pageNumber);
        } else {
            this.setState({pageNumber: pageNumber});
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



    onItemClick(node, index, e) {
        console.log("TableView","onItemClick", node,e);
        if (this.props.onItemClick) {
            this.props.onItemClick(index);
        }
    }



    onItemDoubleClick(node, e) {
        console.log("onItemDoubleClick", node,e);
        // TODO
    }

    notifyDataSetChanged() {
        this.forceUpdate();
    }

    getColValue(node,header) {
        const key = header.key;
        var value = typeof(node.data[key]) != "undefined" ? node.data[key] : null;
        if (value != null && header.formator) {
            value = header.formator(value);
        }
        return value;
    }


    /**这个index是原生数据的index，即第index帧 */
    renderRow(index, node) {
        const Cols = this.props.data && this.props.data.header.map((header,index1) => {
            var value = this.getColValue(node,header)         

            let colStyle = typeof(header.style) != "undefined" ? {...header.style} : {};
            if (typeof(header.align) != "undefined") {
                colStyle.textAlign = header.align;
            }
            if (typeof(header.color) != "undefined") {
                colStyle.color = header.color;
            }
            if (typeof(header.padding) != "undefined") {
                colStyle.padding = header.padding;
            }
            return (
                <td style={colStyle} key={index1}>{value}</td>
            );
        });
        // console.log("active",Styles.active)
        
        return (
            <tr key={node.index} onClick={(e) => this.onItemClick(node.data,node.index,e,)} className={classNames({[Styles.active]: this.props.selectIndex == node.index})}>
                {Cols}
            </tr>
        );
    }

    onHeadClick(index) {
        // this.selectIndex = -1;//去除选中高亮
        if (index == this.state.sortBy) {
            this.setState({descending: !this.state.descending})
        } else {
            this.setState({sortBy: index});
        }
        
    }


    renderHeader(index,data) {
        const OrderIcon = (
            (this.state.descending) ? (
                <img src="./res/img/ic_arrow_down.png" width="16" height="16" alt="descending" />
            ) : (
                <img src="./res/img/ic_arrow_top.png" width="16" height="16" alt="ascending" />
            )
        );

        
        return (
            <th key={index} onClick={e => this.onHeadClick(index)}>{data.name}{this.state.sortBy == index ? OrderIcon : ""}</th>
        );
    }


    sortBy(node,sortBy) {
        const header = this.props.data && this.props.data.header[sortBy];
        if (header) {
            const key = header.key;
            if (typeof(node[key]) != "undefined") {
                return node[key];
            }
        }
        return 0;
    }

    _filter(node,keyword) {
        if (node.name.search(keyword) != -1) {
            return true;
        }
        return false;
    }

    _pager(data) {
        const pageSize = this.props.pageSize;
        const pageNumber = this.getPageNumber();

        let start = pageNumber * pageSize;
        let end = start + pageSize;
        console.log("pager", pageNumber, start, end);
        return data.slice(this.options.endless ? 0 : start, end);
    }

    renderHeaders() {
        const header = this.props.data && this.props.data.header ? this.props.data.header : [];
        return header.map((data, index) => {
            return this.renderHeader(index, data);
        });
    }

    renderRows() {
        const propsData = this.props.data && this.props.data.data ? this.props.data.data : [];
        let data= [];
        for(let i = 0; i < propsData.length; i++){
            data[i] = {data:{...propsData[i]},index:i}
        }
        
        if (this.state.sortBy  != -1){
            data.sort((node1, node2) => {
                const v1 = this.sortBy(node1.data,this.state.sortBy);
                const v2 = this.sortBy(node2.data,this.state.sortBy);
                return this.state.descending ? v2 - v1 : v1 - v2;
            });
        }
        
        if (this.props.filterKey != null && this.props.filterKey != "") {
            data = data.filter((node) => {
                return this._filter(node.data,this.props.filterKey)
            })
        }

        if (this._hasPager()) {
            data = this._pager(data);
        }

        return data.map((data, index) => {
            return this.renderRow(index, data);
        });
    }

    renderColgroups() {
        const header = this.props.data && this.props.data.header ? this.props.data.header : [];
        /**创建 col 数组，用于控制每一列宽度 */
        const Colgroups = header.map((data, index) => {
            let style =  null;
            if (this.colWidths == null) {
                style = data.width !== "auto" ? {width: data.width} : {}
            } else {
                style = {width:'' + this.colWidths[index] + "px"}
            }
            return (
                <col key={index} style={style}></col>
            );
        });
        return Colgroups;
    }

    renderDropLines() {
        /**第一次渲染不会运行，第二次起，创建用于拖动的隐藏div数组 */
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
                let line = <div ref={this.lineRefs[index]} className={Styles.dropLine} style={style}></div>
                dropLines.push(line);
            }
        }
        return dropLines;
    }

    render() {
        const headerJSX = this.renderHeaders();
        const rowsJSX = this.renderRows();
        const colgroups = this.renderColgroups();
        const dropLines = this.renderDropLines();

        return (
            <div id="ccm" ref={this.ref} className={classNames(this.props.className, Styles.tableView)} style={{...this.props.style, width: this.props.width, height: this.props.height}}>
                <div className={Styles.tableViewHeaderBox}>
                    <table className={Styles.tableViewTable}>
                        <colgroup>
                            {colgroups}
                        </colgroup>
                        <thead>
                            <tr style={this.props.headerStyle}>
                                {headerJSX}
                            </tr>
                        </thead>
                    </table>
                </div>

                <div ref={this.tableViewBodyBoxRef} className={Styles.tableViewBodyBox}>
                    <table className={Styles.tableViewTable}>
                        <colgroup>
                            {colgroups}
                        </colgroup>
                        <tbody>
                            {rowsJSX}
                        </tbody>
                    </table>
                    {rowsJSX.length == 0 && (
                        <div className={Styles.tableViewEmptyView}>
                            <div>No Data</div>
                        </div>
                    )}
                </div>

                {dropLines}
            </div>
        );
    }
}


TableView.propTypes = {
    width: PropTypes.string,
    height: PropTypes.string,
    options: PropTypes.object,
    descending: PropTypes.bool,
    sortBy: PropTypes.number,
    data: PropTypes.object,
}
