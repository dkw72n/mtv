

/**
 * <code>
 * const movementHelper = new MovementHelper(callback);
 * </code>
 */

 
const STATE_IDLE = 1;
const STATE_START_MOVE = 2;
const STATE_MOVING = 3;
export const HORIZONTAL = 0;
export const VERTICAL = 1;

class MovementHelper {


    constructor(callback,targetId,targetClassName,grivaty) {
        this.moveState = STATE_IDLE;
        this.startX = 0;
        this.startY = 0;
        this.diffX = 0;
        this.diffY = 0;
        this.diffThreshold = 10;
        this.targetId = targetId;
        this.targetClassName = targetClassName;
        if (grivaty == VERTICAL) {
            this.grivaty = VERTICAL;
        } else {
            this.grivaty = HORIZONTAL;
        }
        console.log("grivaty",this.grivaty)

        this.onMouseDown = this._onMouseDown.bind(this);
        this.onMouseMove = this._onMouseMove.bind(this);
        this.onMouseUp = this._onMouseUp.bind(this);

        this.callback = callback; // {onDown onMove, startMove, endMove }
        this.hoverElementList =[]
    }


    _onMouseDown(event) {
        var tar_id = event.target.id;
        if (this.targetId != null && this.targetId == tar_id) {
            this.moveState = STATE_START_MOVE;
            this.startX = event.clientX;
            this.startY = event.clientY;
            this.diffX = 0;
            this.diffY = 0;
            if (this.callback.onDown != null) {
                this.callback.onDown(event.target);
            }
            event.stopPropagation();
            event.preventDefault();
        } else if(this.targetClassName != null && event.target.className == this.targetClassName) {
            this.moveState = STATE_START_MOVE;
            this.startX = event.clientX;
            this.startY = event.clientY;
            this.diffX = 0;
            this.diffY = 0;
            if (this.callback.onDown != null) {
                this.callback.onDown(event.target);
            }
            event.stopPropagation();
            event.preventDefault();
        }
    }

    _onMouseMove(event) {
        if (this.moveState === STATE_START_MOVE || this.moveState === STATE_MOVING) {
            const x = event.clientX;
            const y = event.clientY;
            this.diffX = x - this.startX;
            this.diffY = y - this.startY;

            if (Math.abs(this.diffX) > this.diffThreshold || Math.abs(this.diffY) > this.diffThreshold) {
                if (this.moveState === STATE_START_MOVE) {
                    this.onStartMoving();
                }
                this.moveState = STATE_MOVING;
                //console.log("moveBy", this.diffX, this.diffY);
                this.callback.onMove(x, y, this.diffX, this.diffY);

                this.startX = event.clientX;
                this.startY = event.clientY;
            }
            let obj = {target:event.target,defStyle:event.target.style.cursor}
            if (!this._isInList(obj)) {
                this.hoverElementList.push(obj);
            }
            if (this.grivaty == HORIZONTAL) {
                event.target.style.cursor = 'col-resize'
            } else {
                event.target.style.cursor = 'row-resize'
            }
            event.stopPropagation();
            event.preventDefault();
        }
    }

    _isInList(obj) {
        for (let index = 0; index < this.hoverElementList.length; index++) {
            let item = this.hoverElementList[index];
            if (item.target == obj.target){
                return true;
            }
        }
        return false;
    }

    _clearCursor() {
        this.hoverElementList.map((item,index) =>{
            item.target.style.cursor = item.defStyle
        })
        this.hoverElementList = [];
    }



    onStartMoving() {
        this.callback.startMove();
    }

    onEndMoving() {
        this.callback.endMove();
    }

    _onMouseUp(event) {
        if (this.moveState === STATE_MOVING) {
            this.onEndMoving();
            event.stopPropagation();
            event.preventDefault();
            this._clearCursor();
        }
        //console.log("_onMouseUp", this.moveState);
        this.moveState = STATE_IDLE;
    }

}

export default MovementHelper;