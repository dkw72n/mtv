import React from 'react';
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import classNames from "classnames"
import { IconContext } from 'react-icons';
import { MdClear } from 'react-icons/md';

import styles from "./SearchInput.css"




export default class SearchInput extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            showAutocomplete: false,
            value: "",
            selectIndex: -1,
        };

        this.onChange = this.onChange.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onFocus = this.onFocus.bind(this);
        this.onBlur = this.onBlur.bind(this);
        this.onDeleteBtnClicked = this.onDeleteBtnClicked.bind(this);
        this.inputRef = React.createRef();
    }

    onChange(e) {
        this.setState({value: e.target.value});

        if (this.props.onChange) {
            this.props.onChange(e.target.value);
        }
    }

    value() {
        return this._get_value();
    }

    _get_value() {
        if (typeof(this.props.value) != "undefined") {
            return this.props.value;
        }
        return this.state.value;
    }

    onDeleteBtnClicked() {
        this.setState({showAutocomplete: true, value: "", selectIndex: -1});

        if (this.props.onChange) {
            this.props.onChange("");
        }
    }

    onKeyUp(e) {
        if (e.keyCode == 38) { // [Arrow Up]
            var selectIndex =  this.state.selectIndex - 1;
            if (selectIndex < 0) {
                selectIndex = 0;
            }
            this.setState({selectIndex: selectIndex, showAutocomplete: true});
        } else if (e.keyCode == 40) { // [Arrow Down]
            var selectIndex =  this.state.selectIndex + 1;
            if (selectIndex >= this.props.autocompleteList.length) {
                selectIndex = this.props.autocompleteList.length - 1;
            }
            this.setState({selectIndex: selectIndex, showAutocomplete: true});
        } else if (e.keyCode === 13) { // [Enter] 
            if (this.state.selectIndex != -1) {
                const selectedItem = this._findItem(this.state.selectIndex);
                if (selectedItem) {
                    this.selectItem(selectedItem);
                }
                return; // 
            }
        }

        if (this.props.onKeyUp) {
            this.props.onKeyUp(e);
        }
    }

    onFocus(e) {
        if (this.dismissTimer) {
            clearTimeout(this.dismissTimer);
        }
        this.setState({showAutocomplete: true});
    }

    onBlur(e) {
        this.dismissTimer = setTimeout(() => {
            this.setState({showAutocomplete: false});
        }, 100);
    }

    onItemClick(e) {
        const index = e.target.dataset.index;
        const item = this.props.autocompleteList[index];
        this.selectItem(item);
    }

    selectItem(item) {
        this.setState({value: item.name, selectIndex: -1, showAutocomplete: false});
        if (this.props.onChange) { // TODO
            this.props.onChange(e.target.value);
        }
    }

    _findItem(selectIndex) {
        var visibleIndex = 0;
        const data =  this.props.autocompleteList ?  this.props.autocompleteList : [];
        var item;
        for (let i = 0 ; i < data.length; i++) {
            item = data[i];
            if (this._filter(item)) {
                if (visibleIndex == selectIndex) {
                    return item;
                }
                visibleIndex++;
            }
        }
        return null;
    }

    _filter(item) {
        let included = true;
        if (this._get_value() && this._get_value().length > 0 && item.name) {
            if (typeof(item.name) === "string") {
                included = item.name.indexOf(this._get_value()) != -1;
            } else {
                included = item.name === this._get_value();
            }
        }
        return included;
    }

    render() {
        const data =  this.props.autocompleteList ?  this.props.autocompleteList : [];
        const AutocompleteList = [];

        var item;
        var visibleIndex = 0;
        for (let i = 0; i < data.length; i++) {
            item = data[i];
            if (this._filter(item)) {
                AutocompleteList.push((
                    <div className={classNames(styles.searchInputAutocompleteItem, {"active": this.state.selectIndex == visibleIndex})} key={i} data-index={i} onClick={(e) => {this.onItemClick(e)}} >
                        <div className={styles.searchInputColorBox} style={{background: item.color}}></div>
                        {item.name}
                    </div>
                ));
                visibleIndex++;
            }
        }
        
        let autocompleteListStyle = null;
        if(this.inputRef.current != null) {
            let width = this.inputRef.current.getBoundingClientRect().right - this.inputRef.current.getBoundingClientRect().left
            autocompleteListStyle = {width:width}
        }

        return (
            <div className={styles.searchInputBox} style={this.props.styles}>
                <div className={styles.searchInputInnerBox}>
                    <input
                        ref={this.inputRef}
                        className={this.props.className}
                        text="search"
                        placeholder={this.props.placeholder}
                        value={this._get_value()}
                        onChange={this.onChange}
                        onKeyUp={this.onKeyUp}
                        onFocus={this.onFocus}
                        onBlur={this.onBlur}
                    />
                    {this._get_value() && (
                    <div className={styles.searchInputClearBtn} onClick={this.onDeleteBtnClicked}>
                        <IconContext.Provider value={{ size: "1em" }}>
                            <MdClear />
                        </IconContext.Provider>
                    </div>
                    )}
                </div>

                {this.state.showAutocomplete && (
                    <div className={classNames(styles.searchInputAutocompleteList)} style={autocompleteListStyle}>
                        {AutocompleteList}
                    </div>
                )}
            </div>
        );
    }


}