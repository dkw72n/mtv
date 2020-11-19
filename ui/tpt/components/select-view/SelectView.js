import React from 'react';
import ReactDOM from 'react-dom';
import styles from './SelectView.css'
import classNames from 'classnames'

function find(data, value) {
    if (data) {
        for (let i = 0; i < data.length; i++) {
            if (data[i].value == value) {
                return data[i];
            }
        }
    }
    return null;
}

function isRectContains(rect, x, y) {
    return rect.left <= x && x <= rect.right
        && rect.top <= y && y <= rect.bottom;
}

const TAG = "SelectView";

export default class SelectView extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            isOpen: false,
            isFocus: false,
        };

        this._divRef = React.createRef();

        this.onSelectClicked = this.onSelectClicked.bind(this);
        this.onOptionClicked = this.onOptionClicked.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
    }

    componentDidMount() {
        this._divRef.current.addEventListener("blur", this.onBlur);
        document.addEventListener("mouseup", this.onMouseUp);
    }

    componentWillUnmount() {
        document.removeEventListener("mouseup", this.onMouseUp);
    }

    onMouseUp(event) {
        const x = event.clientX,
              y = event.clientY,
              rect = this._divRef.current.getBoundingClientRect();
        //console.log(TAG, "onMouseUp", x, y, rect, isRectContains(rect, x, y));

        if (isRectContains(rect, x, y)) {
            if(!this.state.isFocus) {
                this.onFocus();
            }
        } else {
            if (this.state.isFocus) {
                this.onBlur();
            }
            if (this.state.isOpen) {
                this.closeDropdown();
            }
        }
    }

    onFocus() {
        this._timer = setTimeout(() => {
            this.setState({ isFocus: true });
        }, 300);
    }

    onBlur() {
        this._timer = setTimeout(() => {
            this.setState({ isFocus: false });
        }, 300);
    }

    closeDropdown() {
        this._timer = setTimeout(() => {
            this.setState({ isOpen: false });
        }, 300);
    }
    
    openDropdown() {
        this.setState({ isOpen: true });
    }

    onOptionClicked(item) {
        if (this.props.onChange && this.props.value != item.value) {
            this.props.onChange(item.value);
        }
        this.setState({ isOpen: false });
    }

    onSelectClicked(event) {
        this.setState({ isOpen: !this.state.isOpen });
    }

    render() {
        const data = this.props.options ? this.props.options : [];
        var maxItemText = "";
        const Items = data.map((item, index) => {
            if (item.label.length > maxItemText.length) {
                maxItemText = item.label;
            }
            return (
                <div key={index} className={classNames(styles.selectDropdownItem, {[styles.disabled] : item.disabled}, {[styles.selected] : item.value == this.props.value})} onClick={(e) => { if (!item.disabled) { this.onOptionClicked(item); e.stopPropagation(); e.preventDefault(); } }} disabled={item.disabled}>
                    {item.label}
                </div>
            );
        });

        const selectOption = find(this.props.options, this.props.value);

        return (
            <div ref={this._divRef} className={classNames(styles.selectWrapper, this.props.className)}>
                <div className={classNames(styles.select, {[styles.focus] : this.state.isFocus})} style={this.props.btnStyle} onClick={() => { this.onSelectClicked() }}>
                    {selectOption != null ? selectOption.label : ''}<div className={styles.selectArrow} />
                </div>
                { this.state.isOpen && (
                    <div className={styles.selectDropdown}>
                        {Items}
                    </div>
                )}
                <div className={styles.selectPlaceholder}>
                    {maxItemText}
                </div>
            </div>
        );
    }
}


