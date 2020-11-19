/* jshint esversion: 6 */
import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import TableView from "./TableView"
import Styles from "./TableView.css"
import classNames from 'classnames'
import TreeTableStyle from "./TreeTableView.css"


function walkTree(node, func, comparetor = null, pageModule = false, pageCount = 0, pageFnc = null) {
    console.log("walkTree", node.data.name)
    let isCollapsed = func(node);
    if (node.children && !isCollapsed) {
        if (comparetor) node.children.sort(comparetor);
        for (let i = 0; i < node.children.length; i++) {
            if (pageModule) {
                let count = node.pageNumber * pageCount
                if (i < count) {
                    walkTree(node.children[i], func, comparetor, pageModule, pageCount, pageFnc);
                } else {
                    console.log("walkTree_pageFnc", node.data.name)
                    if (pageFnc) pageFnc(node);
                    break;
                }
            } else {
                walkTree(node.children[i], func, comparetor, pageModule, pageCount, pageFnc);
            }
        }
    }
}

/**
 * Tree Table View
 */
export default class TreeTableView extends TableView {

    constructor(props) {
        super(props);
        this.options = Object.assign({
            pageCount: 2,
            pageModule: true
        }, this.props.options);
        this.initData(this.props.data, this.props.getChildren, this.props.filterKey);
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!this._isObjectValueEqual(nextProps.data, this.props.data) || this.props.filterKey != nextProps.filterKey) {
            console.log("needUpdata", nextProps.data, this.props.data, (this.props.data == nextProps.data))
            this.initData(nextProps.data, nextProps.getChildren, nextProps.filterKey);
        }
        return true;
    }

    _isObjectValueEqual(a, b) {//判断两个对象是否相等
        var aProps = Object.getOwnPropertyNames(a);
        var bProps = Object.getOwnPropertyNames(b);
        if (aProps.length != bProps.length) {
            return false;
        }
        for (var i = 0; i < aProps.length; i++) {
            var propName = aProps[i]

            var propA = a[propName]
            var propB = b[propName]
            if ((typeof (propA) === 'object')) {
                if (this._isObjectValueEqual(propA, propB)) {
                    return true
                } else {
                    return false
                }
            } else if (propA !== propB) {
                return false
            } else { }
        }
        return true;
    }

    initData(data, getChildren, keyword) {

        this.root = d3.hierarchy(data.data, getChildren);
        console.log("root", this.root)
        var stack = [];
        stack.push(this.root)
        let node = null;
        let id = 0;
        while ((node = stack.pop())) {
            node.id = id++;
            if (node.depth > 1) {
                node.hide = true;
            } else {
                node.hide = false;
            }
            let children = node.children;

            if (children && children.length) {
                if (keyword != null && keyword != "") {//TODO 过滤
                    node.children = node.children.filter((node) => {
                        if (node.children && children.length) {
                            return true;//父节点不过滤
                        }
                        return this._filter(node.data, keyword, data.header[0])
                    })
                }
                children = node.children;
            }

            let i;
            if (children && (i = children.length)) {
                node.pageNumber = 1;
                if (!node.hide && node.depth > 1) {
                    node.isCollapsed = false;
                } else {
                    node.isCollapsed = true;
                }
                while (i--) {
                    stack.push(children[i]);
                }
            }
        }
        console.log("this.root", this.root);
    }

    _filter(node, keyword, header) {
        let value = header.getValue(node);
        if (value == null) {
            return false;
        }
        if (value.search(keyword) != -1) {
            return true;
        }
        return false;
    }

    onItemCollapsedBtnClick(node, e) {
        node.isCollapsed = !node.isCollapsed;
        if (node.isCollapsed) {
            walkTree(node, (child) => {
                if (child != node) {
                    child.data.hide = true;
                    child.data.isCollapsed = true;
                }
                return false;
            })
        } else if (node.children != null) {
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                child.hide = false;
            }
        }
        this.notifyDataSetChanged();
    }

    notifyDataSetChanged() {
        this.forceUpdate();
    }

    getColValue(node, header) {
        var value = header.getValue(node.data);
        if (value != null && header.formator) {
            value = header.formator(value);
        }
        return value;
    }

    getSortCount(node) {
        let sortBy = this.state.sortBy;
        if (sortBy == -1) {
            return 1;
        }
        let header = this.props.data.header[sortBy]
        if (header == null) {
            return 1;
        }
        let result = this.getColValue(node, header);
        return result;
    }


    renderRows() {

        const Rows = [];

        walkTree(this.root, (node) => {
            if (node.depth == 0) {
                return false;//root节点跳过
            }
            if (!node.hide) {
                Rows.push(this.renderRow(0, node));
            }
            return node.isCollapsed;
        }, (node1, node2) => {
            const v1 = this.getSortCount(node1);
            const v2 = this.getSortCount(node2);
            return this.state.descending ? v2 - v1 : v1 - v2;
        }, this.options.pageModule, this.options.pageCount, (node) => {
            let pageRow = this.randerPageRow(node)
            if (pageRow) {
                Rows.push(pageRow);
            }
        });
        return Rows;
    }

    randerPageRow(node) {
        console.log("randerPageRow", node)
        let pageNumber = node.pageNumber;
        let pageCount = this.options.pageCount;
        let childCount = node.children.length;
        let maxPageNumber = Math.ceil(childCount / pageCount)
        let prev = null;
        if (pageNumber > 1) {
            prev = <button className={TreeTableStyle.pageButton} onClick={() => this.previousPage(node)}>上一页</button>
        }
        let next = null;
        if (pageNumber < maxPageNumber) {
            next = <button className={TreeTableStyle.pageButton} onClick={() => this.nextPage(node)}>下一页</button>
        }
        let all = null;
        if (pageNumber != maxPageNumber) {
            all = <button className={TreeTableStyle.pageButton} onClick={() => this.showAllPage(node)}>显示所有</button>
        }
        if (prev == null && next == null && all == null) {
            return null;
        }
        var indent = [];
        for (var i = 0; i < node.depth; i++) {
            indent.push((<b key={i} />));
        }

        let colspan = this.props.data.header.length;
        return <tr className={TreeTableStyle.pageLine}><td colSpan={colspan}><div style={{ width: this.width }}>{indent}{prev}{all}{next}</div></td></tr>
    }

    previousPage(node) {
        node.pageNumber = node.pageNumber - 1;
        this.notifyDataSetChanged();
    }

    nextPage(node) {
        node.pageNumber = node.pageNumber + 1;
        this.notifyDataSetChanged();
    }

    showAllPage(node) {
        let pageCount = this.options.pageCount;
        let childCount = node.children.length;
        let maxPageNumber = Math.ceil(childCount / pageCount)
        node.pageNumber = maxPageNumber;
        this.notifyDataSetChanged();
    }

    renderRow(index, node) {
        const Cols = this.props.data && this.props.data.header.map((header, index1) => {

            var value = this.getColValue(node, header)
            let colStyle = typeof (header.style) != "undefined" ? { ...header.style } : {};
            if (typeof (header.align) != "undefined") {
                colStyle.textAlign = header.align;
            }
            if (typeof (header.color) != "undefined") {
                colStyle.color = header.color;
            }
            if (typeof (header.padding) != "undefined") {
                colStyle.padding = header.padding;
            }

            var indent = [];
            if (index1 == 0) {
                for (var i = 1; i < node.depth; i++) {
                    indent.push((<b key={i} />));
                }
            }

            const hasChild = node.children && node.children.length > 0;
            const isCollapsed = node.isCollapsed;
            const onItemCollapsedBtnClick = this.onItemCollapsedBtnClick.bind(this, node);


            return (
                <td style={colStyle}>
                    {indent}
                    {hasChild && index1 == 0 ?
                        isCollapsed ? (
                            <img src="./res/img/ic_arrow_right.png" width="16" height="16" alt="arrow right" onClick={onItemCollapsedBtnClick} />
                        ) : (
                                <img src="./res/img/ic_arrow_down.png" width="16" height="16" alt="arrow down" onClick={onItemCollapsedBtnClick} />
                            )
                        : (
                            <span style={{ display: "inline-block", width: "16px", height: "16px" }} />
                        )}
                    {value}
                </td>
            );
        });
        const onItemDoubleClick = this.onItemCollapsedBtnClick.bind(this, node);

        return (
            <tr key={node.index} onClick={(e) => this.onItemClick(node.data, node.id, e)} onDoubleClick={onItemDoubleClick} className={classNames({ [Styles.active]: this.props.selectIndex == node.id })}>
                {Cols}
            </tr>
        );
    }

    render() {
        return super.render();
    }

}

TreeTableView.propTypes = {
    width: PropTypes.string,
    height: PropTypes.string,
    options: PropTypes.object,
    descending: PropTypes.bool,
    sortBy: PropTypes.number,
    data: PropTypes.object,
}
