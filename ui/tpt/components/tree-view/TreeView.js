import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import classNames from 'classnames'


import styles from "./TreeView.css"

function formatFloat(value) {
    if (typeof(value) != "undefined") {
        return parseFloat(value).toFixed(2);
    }
    return "NaN";
}

function formatPercent(value) {
    if (typeof(value) != "undefined") {
        return parseFloat(value).toFixed(2) + ' %';
    }
    return "NaN %";
}

function walkTree(node, func, comparetor = null) {
    if (!node) {
        return;
    }
    func(node);
    if (node.children) {
        if (comparetor) node.children.sort(comparetor);
        for (let i = 0; i < node.children.length; i++) {
            walkTree(node.children[i], func, comparetor);
        }
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
 * Tree View
 */
export default class TreeView extends React.Component {

    constructor(props) {
        super(props);

        this.options = Object.assign({
            //selfValue: true,
            defaultCollapsed: true,
            nanoTimeUnit: false,
        }, this.props.options);

        this.state = {
            selectId : -1
        };

        this.initData(this.props.data, this.props.getChildren,this.props.filter);
    }

    initData(data, getChildren,filter) {
        if (filter != null) {
            data = this._depthCopy(data, getChildren);
            data = this._filter(data, getChildren, filter);
        }
        this.data = data;
        if (data) {
            this.root = d3.hierarchy(data, getChildren);
        } else {
            this.root = null;
        }
        this.reappraiseNode(data);
        console.log("root",this.root)
    }

    getShowData() {
        return this.data;
    }

    _depthCopy(data,getChildren) {
        if (data == null) {
            return data;
        }
        let copyData = {...data}
        var stack = [];
        stack.push(copyData)
        let node,children, i;
        while ((node = stack.pop())) {
            children = getChildren(node);
            if (children && (i = children.length)) {
                let copyChildren = []
                while (i--) {
                    let child = {...children[i]}
                    copyChildren.push(child);
                    stack.push(child);
                }
                node.children = copyChildren;
            }
        } 
        return copyData;
    }

    _filter(data,getChildren,filter) {
        if (data == null) {
            return null;
        }
        if (filter(data)){
            return null;
        }
        var stack = [];
        stack.push(data);
        let node, children, i;
        while ((node = stack.pop())) {
            children = getChildren(node);
            if (children && (i = children.length)) {
                while (i--) {
                    let child = children[i];
                    if (filter(child)) {
                        children.splice(i, 1)
                    } else {
                        stack.push(child);
                    }
                }
            }
        }
        return data;
    }

    reappraiseNode(data) {
        if (!data) {
            return;
        }

        const root = this.root;

        var id = 0;
        var item = root.data
        item.id = id;
        item.hide = false;
        item.isCollapsed = false;
     
        item.valuePercent = 1.0;
        item.calls = 1;
        var node, children, child, i, j, childrenValue, childValue;
        var stack = [];
        //const compoundValue = !this.options.selfValue;

        var rootChildTotalValue = 0;
        if (root.children) {
            for (let i = 0; i < root.children.length; i++) {
                rootChildTotalValue += this.props.getValue(root.children[i].data);
            }
        }

        var totalValue = this.props.getValue(root.data)
        if (!totalValue) { // "_root"
            totalValue = rootChildTotalValue;
            item.selfValue = 0;
            item.selfPercent = 0;
        } else {
            root.value = totalValue;
            item.selfValue = totalValue - rootChildTotalValue;
            item.selfPercent = item.selfValue / (totalValue * 1.0);;
        }

        stack.push(root)
        while ((node = stack.pop())) {
            children = node.children;
            childrenValue = 0;
            if (children && (i = children.length)) {
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
            } 
            node.data.selfValue = node.value - childrenValue;
            node.data.selfPercent = node.data.selfValue / (totalValue * 1.0);
        }
    }


    _expandNodeAndParent(node) {
        if(node == null) {
            return
        }
        
        node.data.hide = false;
        if(node.children && node.children.length > 0) {
            node.data.isCollapsed = false;
            let children = node.children
            let i = children.length;
            while(i--) {
                children[i].data.hide = false;
            }
        }

        this._expandNodeAndParent(node.parent)
    }

    searchByKeyword(keyword) {
        let targetNode = null;
         walkTree(this.root, (child) => {
            if (child.name != keyword) {
                // found target node, expand this node and all his parent
                targetNode = child;
            }
            return true;
        });
        console.log("treeView","search result",targetNode)
        if (targetNode) {
            console.log(targetNode.data.isCollapsed,targetNode.data.id)
            if (targetNode.data.isCollapsed && targetNode.data.id != this.state.selectedId) {
                this._expandNodeAndParent(targetNode);
                this.setState({selectId : targetNode.data.id }); //  等同于调用了 this.notifyDataSetChanged();
            }
        }  
    }
 



    onItemClick(node, e) {
        console.log("onItemClick", node.data.id,node);
        this.setState({selectId: node.data.id});
    }

    onItemCollapsedBtnClick(node, e) {
        console.log("onItemCollapsedBtnClick", node);
        node.data.isCollapsed = !node.data.isCollapsed;
        console.log("onItemCollapsedBtnClick___", node.data.isCollapsed);
        if (node.data.isCollapsed) {
            walkTree(node, (child) => {
                if (child != node) {
                    child.data.hide = true;
                    child.data.isCollapsed = true;
                }
            })
        } else {
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
        if (!node) {
            return;
        }

        if (this.props.minTime && node.value < this.props.minTime) {
            return;
        }

        const data = node.data;
        if (data.hide) {
            return;
        }
        //console.info(node.data.name, ": isCollapsed", data.isCollapsed, "hide", data.hide, "node", node);

        const hasChild = node.children && node.children.length > 0;
        const isCollapsed = node.data.isCollapsed;
        const onItemCollapsedBtnClick = this.onItemCollapsedBtnClick.bind(this, node);
        const onItemClick = this.onItemClick.bind(this, node);
        const onItemDoubleClick = this.onItemCollapsedBtnClick.bind(this, node);

        var indent = [];
        for (var i = 0; i < node.depth; i++) {
            indent.push((<b className={styles.tab} key={i} />));
        }

        //console.log("this.state.selectId == data.id", this.state.selectId, data.id);

        const activeClassName = styles.active;
        var selfWidth = parseInt(Math.floor(data.selfValue / node.value * 110));
        if (selfWidth == 0 && data.selfValue > 0) {
            selfWidth = 4;
        }
        //console.log("selfWidth", data.selfValue, node.value, selfWidth, this.props.showPercent);
        const floatFormator = this.props.formatFloat ? this.props.formatFloat : formatFloat;
        const formatTime = (value) => {
            return floatFormator(this.options.nanoTimeUnit ? value / 1000: value);
        };
        const percentFormator = this.props.formatPercent ? this.props.formatPercent : formatPercent;
        return (
            <div key={data.id} onClick={onItemClick} onDoubleClick={onItemDoubleClick} className={classNames(styles.row)}>
                {indent}

                {hasChild ? 
                    isCollapsed ? (
                        <img className={styles.arrow} src="./res/img/ic_arrow_right.png" width="16" height="16" alt="arrow right" onClick={onItemCollapsedBtnClick} />
                    ) : (
                        <img className={styles.arrow} src="./res/img/ic_arrow_down.png" width="16" height="16" alt="arrow down" onClick={onItemCollapsedBtnClick} />
                    )
                    : (
                    <span style={{display: "inline-block", width: "16px", height: "16px"}} />
                )}
                <div className={classNames(styles.selectBox, {[activeClassName]: this.state.selectId == data.id})}>
                    <div className={styles.bar}>
                        <span className={styles.selfBg} style={{width: selfWidth + "px"}}></span>
                        <span className={styles.total}>{this.props.showPercent ? percentFormator(data.valuePercent) : formatTime(node.value)}</span>
                        <span className={styles.self}>{this.props.showPercent ? percentFormator(data.selfPercent) : formatTime(data.selfValue)}</span>
                    </div>
                    <span className={styles.name}>{data.name}</span>
                </div>
        </div>
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

    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.data != this.props.data || nextProps.filter != null || (this.props.filter != null && nextProps.filter == null)) {
            this.initData(nextProps.data, nextProps.getChildren,nextProps.filter);
            console.log("kakaka111111")
        } 
        return true;
    }

    render() {
        console.log("TreeView", "render", "root", this.root, "props", this.props);
        const Rows = [];

        walkTree(this.root, (node) => {
            Rows.push(this.renderRow(node));
        }, (node1, node2) => {
            const v1 = this.sortBy(node1);
            const v2 = this.sortBy(node2);
            return this.props.descending ? v2 - v1 : v1 - v2;
        });

        const OrderIcon = (
            (this.props.descending) ? (
                <img src="./res/img/ic_arrow_down.png" width="16" height="16" alt="descending" />
            ) : (
                <img src="./res/img/ic_arrow_top.png" width="16" height="16" alt="ascending" />
            )
        );
        const sortBy = this.props.sortBy;

        return (
            <div style={this.props.style} className={classNames(this.props.className, styles.treeView)}>
                {Rows}
            </div>
        );
    }
}


TreeView.propTypes = {
    options: PropTypes.object,
    descending: PropTypes.bool,
    sortBy: PropTypes.number,
    data: PropTypes.object,
    getValue: PropTypes.func,
    getChildren: PropTypes.func,
    onHeadClick: PropTypes.func,
}
