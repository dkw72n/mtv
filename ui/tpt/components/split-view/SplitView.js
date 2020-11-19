
import React from 'react';
import MovementHelper from './MovementHelper.js'
import Styles from './SplitView.css'
import classNames from 'classnames'

const SplitPanelView = React.forwardRef((props, ref) => (
    <div ref={ref}
         className={props.className}
         style={props.style}
    >
        {props.children}
    </div>
));

const SplitResizer = React.forwardRef((props, ref) => (
    <div ref={ref}
        id={props.id}
        style={props.style}
        className={props.className}
    >
        {props.children}
    </div>
));

export const HORIZONTAL = 0;
export const VERTICAL = 1;

function unfocusAll() {
    if (document.selection) {
      document.selection.empty();
    } else {
      try {
        window.getSelection().removeAllRanges();
        // eslint-disable-next-line no-empty
      } catch (e) {}
    }
  }

class SplitView extends React.Component {

    constructor(props) {
        super(props);

        this.orientation = typeof (this.props.orientation) !== "undefined" ? this.props.orientation : VERTICAL;
        this.defaultSecondarySize = typeof (this.props.defaultSecondarySize) !== "undefined" ? this.props.defaultSecondarySize : "20%";
        this.defaultResizerSize = typeof (this.props.defaultResizerSize) != "undefined" ? this.props.defaultResizerSize : 10;
        this.minPanelSize = typeof (this.props.minPanelSize) != "undefined" ? this.props.minPanelSize : 50;

        this.ref = React.createRef();
        this.primaryPanel = React.createRef();
        this.secondaryPanel = React.createRef();
        this.resizer = React.createRef();

        this.width = 0;
        this.height = 0;
        

        this.containerStyle = {
            display: "flex",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            alignItems: "stretch",
            position: "relative",
            flexDirection: this.props.orientation === VERTICAL ? "column" : "row"
        };

        this.state = {
            primaryPanelStyle: {
                flexGrow: 1,                           // grow
                flexShrink: 1,                         // shrink
                flexBasis: "auto",                     // auto size 
                //overflow: "hidden",
            },
            secondaryPanelStyle: {
                flexGrow: 0,                           // no grow
                flexShrink: 0,                         // no shrink
                flexBasis: this.defaultSecondarySize,  // fixed size
                maxHeight: this.defaultSecondarySize,  // maxHeight
                //overflow: "hidden",
            },
            resizerStyle: {
                flexGrow: 0,                           // no grow
                flexShrink: 0,                         // no shrink
                flexBasis: this.defaultResizerSize,    // fixed size
            }
        };
        if (this.props.orientation === VERTICAL) {
            this.state.primaryPanelStyle.width = "100%";
            this.state.secondaryPanelStyle.width = "100%";
            this.state.resizerStyle.width = "100%";
            this.state.resizerStyle.cursor = "row-resize";
            this.state.primaryPanelStyle.overflow = "hidden auto";
            this.state.secondaryPanelStyle.overflow = "hidden auto";
        } else {
            this.state.primaryPanelStyle.height = "100%";
            this.state.secondaryPanelStyle.height = "100%";
            this.state.resizerStyle.height = "100%";
            this.state.resizerStyle.cursor = "col-resize";
            this.state.primaryPanelStyle.overflow = "auto hidden";
            this.state.secondaryPanelStyle.overflow = "auto hidden";
        }

        this._resize = this.onResize.bind(this);

        this.randomId = Math.random().toString(36).slice(-8);
        this.resizerMovementHelper = new MovementHelper({
            startMove: () => this.onResizerStartMove(),
            onMove : (x, y, diffX, diffY) => { this.onResizerMoving(diffX, diffY) },
            endMove: () => this.onResizerEndMove(),
        },this.randomId,null,this.orientation);
        this.onResizerMouseDown = this.resizerMovementHelper.onMouseDown;
        this.onMouseMove = this.resizerMovementHelper.onMouseMove;
        this.onMouseUp = this.resizerMovementHelper.onMouseUp;
    }

    componentDidMount() {
        console.log(this.props.id, "componentDidMount");
        this.ref.current.addEventListener('mousedown', this.onResizerMouseDown,true);
        window.addEventListener('mouseup', this.onMouseUp,true);
        this.ref.current.addEventListener('mousemove', this.onMouseMove,true);

        this.onResize();
    }

    componentWillUnmount() {
        console.log(this.props.id, "componentWillUnmount");
        this.ref.current.removeEventListener('mousedown', this.onResizerMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        this.ref.current.removeEventListener('mousemove', this.onMouseMove);
    }

    onResize() {
        this.width = this.ref.current.clientWidth;
        this.height = this.ref.current.clientHeight;

        //this.onResizerMoving(0, 0); // re-calculate secondary panel's size
    }

    _convertPercentToPx(base, value) {
        if (typeof(value) === "string" && value.endsWith("%")) {
            return parseInt(base * parseInt(value.substring(0, value.length - 1)) / 100);
        }
        return value;
    }

    onResizerStartMove() {
        this.onResize();
        if (this.props.onResizerStartMove) {
            this.props.onResizerStartMove();
        }
    }

    onResizerEndMove() {
        if (this.props.onResizerEndMove) {
            this.props.onResizerEndMove();
        }
    }

    onResizerMoving(diffX, diffY) {
        console.log("onResizerMoving", diffX, diffY);
        unfocusAll();
        this.ref.current.focus();

        var secondaryPanelStyle = { ...this.state.secondaryPanelStyle };
        var primaryPanelStyle = { ...this.state.primaryPanelStyle, flexGrow: 0, flexShrink: 0 };
        if (this.orientation === VERTICAL) {
            secondaryPanelStyle.flexBasis = this._convertPercentToPx(this.height, secondaryPanelStyle.flexBasis) - diffY;
            primaryPanelStyle.flexBasis = this.height - secondaryPanelStyle.flexBasis - this.state.resizerStyle.flexBasis;
        } else {
            secondaryPanelStyle.flexBasis = this._convertPercentToPx(this.width, secondaryPanelStyle.flexBasis) - diffX;
            primaryPanelStyle.flexBasis = this.width - secondaryPanelStyle.flexBasis - this.state.resizerStyle.flexBasis;
        }
        secondaryPanelStyle.height = secondaryPanelStyle.flexBasis;
        secondaryPanelStyle.maxHeight = secondaryPanelStyle.flexBasis;
        primaryPanelStyle.height = primaryPanelStyle.flexBasis;
        primaryPanelStyle.maxHeight = primaryPanelStyle.flexBasis;
        //primaryPanelStyle.pointerEvents = "none";
        //secondaryPanelStyle.pointerEvents = "none";

        this.setState({ primaryPanelStyle, secondaryPanelStyle });

        if (this.props.onResize) {
            this.props.onResize();
        }
    }

    render() {
        console.log(this.props.id, "render", this.state, this.props, this.orientation, this.defaultSecondarySize, this.primaryPanelIndex);
        const children = React.Children.toArray(this.props.children).filter(c => c);
        if (children.length !== 2) {
            console.error("SplitView", "split view must have 2 children");
            return null;
        }

        const containerStyle = this.containerStyle;
        const {primaryPanelStyle, resizerStyle, secondaryPanelStyle} = this.state;

        return (
            <div ref={this.ref} className={Styles.splitView} style={containerStyle}>

                <SplitPanelView
                    ref={this.primaryPanel}
                    className={classNames(Styles.splitPanelView,Styles.primaryPanel)}
                    style={primaryPanelStyle} >
                    {children[0]}
                </SplitPanelView>

                <SplitResizer
                    id = {this.randomId}
                    ref={this.resizer}
                    className={Styles.panelResizer}
                    style={resizerStyle} />

                <SplitPanelView
                    ref={this.secondaryPanel}
                    className={classNames(Styles.splitPanelView,Styles.secondaryPanel)}
                    style={secondaryPanelStyle} >
                    {children[1]}
                </SplitPanelView>
            </div>
        );
    }


}

export default SplitView;

