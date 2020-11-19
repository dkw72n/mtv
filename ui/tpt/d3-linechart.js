(function(window, d3) {

    function drawRoundRect(ctx, x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x+r, y);
        ctx.arcTo(x+w, y,   x+w, y+h, r);
        ctx.arcTo(x+w, y+h, x,   y+h, r);
        ctx.arcTo(x,   y+h, x,   y,   r);
        ctx.arcTo(x,   y,   x+w, y,   r);
        ctx.closePath();
    }

    const IDEL       = 0;
    const START_MOVE = 1;
    const MOVING     = 2;

    const DEBUG_LINE = false;

    function CanvasLineChart(canvas, options) {
        this.canvas = canvas;
        this.id = canvas.id;
        this.selectX = -1;
        this.selectX = -1;
        this.showData = null;
        this.realData = null;
        this.offset = 0;
        this.dirty = false;
        this.callback = null;
        this.mouseState = false;
        this.autoScroll = true;
        this.requestDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.diffX = 0;
        this.diffY = 0;
        this.clickableElements = []

        this.options = Object.assign({
            margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            },
            lineWidth: 1,
            frameLineWidth: 1,
            frameLineDash: true,
            minY: 0,
            drawLabelText: true,
            showDebugWindow: true,
            areaModel:false,
            stackModel: false, // 是否累加
            selectLineLabelFormat: d3.format(">-.2f"),
            yAxisLabelFormat: (value) => { return value + ""}
        }, options);

        this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
        window.addEventListener("mousemove", (e) => this.onMouseMove(e));
        window.addEventListener("mouseup",   (e) => this.onMouseUp(e));

        window.addEventListener("resize",   (e) => this.onWindowResize(e));

        this.init();
    }

    CanvasLineChart.prototype.init = function () {
        //console.debug("window.devicePixelRatio", window.devicePixelRatio);
        const dpr = /* window.devicePixelRatio || */ 1;
        const parentSize = this.canvas.parentNode.getBoundingClientRect();

        this.margin = this.options.margin;
        this.canvas.width = this.width = parentSize.width * dpr - this.margin.left - this.margin.right;
        this.canvas.height = this.height = parentSize.height * dpr - this.margin.top - this.margin.bottom;
        this.length = this.width;
        this.context = this.canvas.getContext("2d");
        //this.context.scale(dpr, dpr);
        this.context.translate(this.margin.left, this.margin.top);

        this.x = d3.scaleLinear().range([0, this.width]).nice();
        this.vx = d3.scaleLinear().range([0, this.width]).nice();
        this.x.domain([0, this.width]);
        this.vx.domain([0, this.width]);
        this.y = d3.scaleLinear().range([this.height, 0]);
        //console.debug("x.range", [0, this.width]);
        //console.debug("x.domain", [0, this.width]);
        //console.debug("y.range", [this.height, 0]);
        
        this.line = null;
        if (this.options.areaModel) {
            this.line = d3.area()
                //.x((d, i) => this.vx(this.showData.xAxis[i]) )
                .x((d, i) => { if (DEBUG_LINE) { console.debug("x", "d", d, "i", i, "this.vx(i)", this.vx(i)); } return i; } ) // TODO: 直接使用x，则会导致无法从右侧开始绘制线
                .y1((d, i) => { if (DEBUG_LINE) { console.log("y", "d", d, "i", i, "this.y(d)", this.y(d)); } return this.y(d); } )
                .y0(this.y(0))
                .curve(d3.curveBasis)
                .context(this.context)
        } else {
            this.line = d3.line()
                //.x((d, i) => this.vx(this.showData.xAxis[i]) )
                .x((d, i) => { if (DEBUG_LINE) { console.debug("x", "d", d, "i", i, "this.vx(i)", this.vx(i)); } return i; } ) // TODO: 直接使用x，则会导致无法从右侧开始绘制线
                .y((d, i) => { if (DEBUG_LINE) { console.log("y", "d", d, "i", i, "this.y(d)", this.y(d)); } return this.y(d); } )
                .curve(d3.curveBasis)
                .context(this.context)  

        }
        
        
    }

   
    CanvasLineChart.prototype.onWindowResize = function (e) {
        console.log("CanvasLineChart", "onWindowResize", e);
        this.init();
        this.invalidate();
    }

    CanvasLineChart.prototype.onMouseDown = function (e) {
        this.mouseState = START_MOVE;
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.diffX = 0;
        this.diffY = 0;
    }

    CanvasLineChart.prototype.onMouseMove = function (e) {
        if (this.mouseState == START_MOVE || this.mouseState == MOVING) {
            var x = event.clientX;
            var y = event.clientY;
            this.diffX = x - this.startX;
            this.diffY = y - this.startY;
 
            if (Math.abs(this.diffX) > 10 || Math.abs(this.diffY) > 10) {
                if (this.mouseState == START_MOVE) {
                    this.onStartMoving();
                }
                this.mouseState = MOVING;
                this.canvas.style.cursor = "pointer";
                //console.log("moveBy", this.diffX, this.diffY);
                var offset = this.offset - this.diffX;
                this.setOffset(offset, true);

                this.startX = event.clientX;
                this.startY = event.clientY;
            }
        }

        /*
        // show/hide scrollbar
        if (this.scrollBarElement) {
            if (1 <= event.offsetY && event.offsetY <= this.scrollBarHeight && event.target == this.canvas) {
                this._setScrollBarVisible(true);
            } else {
                this._setScrollBarVisible(false);
            }
        }
        */
    }

    CanvasLineChart.prototype.onStartMoving = function () {
        if (this.callback && typeof(this.callback.onStartMoving) != "undefined") {
            this.callback.onStartMoving();
        }
    }

    CanvasLineChart.prototype.onMouseUp = function (e) {
        if (this.mouseState == MOVING) {
            // on end moving
            this.canvas.style.cursor = "default";
        } else {
            // not moved
            if (e.target == this.canvas) {
                this.onClick(e);
            }
        }

        this.mouseState = IDEL;
    }

    CanvasLineChart.prototype.onClick = function (e) {
        const x = e.offsetX,
              y = e.offsetY;

        var handled = false;
        for (let key in this.clickableElements) {
            const elem = this.clickableElements[key];

            if (y > elem.rect.top && y < elem.rect.bottom 
                && x > elem.rect.left && x < elem.rect.right) {
                this.onClickableElementClicked(elem);
                e.stopPropagation(); // 阻止事件向上冒泡
                handled = true;
                break;
            }
        }

        if (handled) {
            return;
        }

        // console.log("onClick", e, e.offsetX, e.offsetY);
        this.setSelectX(e.offsetX);
    }

    CanvasLineChart.prototype.onClickableElementClicked = function (clickableElement) {
        if (clickableElement.data.type == "label") {
            if (this.callback && typeof(this.callback.onLabelClicked) != "undefined") {
                this.callback.onLabelClicked(clickableElement.data.name);
            }
        }
    }

    CanvasLineChart.prototype.setSelectX = function (x) {
        if (x != this.selectX) {
            this.selectX = x;
            this._notifySelectChanged(x);
            this.invalidate();
        }
    }

    CanvasLineChart.prototype.setAutoScroll = function (autoScroll) {
        this.autoScroll = autoScroll;

        this._notifyAutoScrollChanged();
    }

    CanvasLineChart.prototype.setScrollBarElement = function (scrollBarElement) {
        this.scrollBarElement = d3.select(scrollBarElement);
        this.scrollBarInnerElement = this.scrollBarElement.append("div");
        this._setScrollBarVisible(false);
        this._initScrollBar();
    }

    CanvasLineChart.prototype._initScrollBar = function () {
        // console.log("initScrollBar");
        if (this.scrollBarElement == null) {
            return;
        }

        this.scrollBarElement.style("width", this.width + "px")
                    .on("scroll", this.onScrollBarScroll.bind(this));
        this.scrollBarHeight = 20;
        this.scrollBarInnerElement.style("width", this.width + "px");
        //this.scrollBarElement.height = Math.min(parseInt(Math.floor(this.canvas.height * 0.2)), 50);
    }

    CanvasLineChart.prototype._updateScrollBar = function () {
        if (this.scrollBarElement == null) {
            return;
        }

        this.scrollBarInnerElement.style("width", Math.max(this.width, this.max_length) + "px");
    }

    CanvasLineChart.prototype.onScrollBarScroll = function (event) {
        if (this.preventScrollEvent) {
            this.preventScrollEvent = false;
            return;
        }

        this.setAutoScroll(false);
        this.setOffset(this.scrollBarElement.node().scrollLeft, true, true, false);
    }

    CanvasLineChart.prototype._setScrollBarVisible = function (visible) {
        if (this.scrollBarElementVisible != visible) {
            this.scrollBarElementVisible = visible;
            this.scrollBarElement.style("display", visible ? "block" : "none");

            this.preventScrollEvent = true;
            this.scrollBarElement.node().scrollLeft = this.offset;
        }
    }

    CanvasLineChart.prototype._notifyAutoScrollChanged = function () {
        if (this.callback && typeof(this.callback.onAutoScrollChanged) != "undefined") {
            this.callback.onAutoScrollChanged(this.autoScroll);
        }
    }

    CanvasLineChart.prototype._notifySelectChanged = function (x) {
        if (this.callback && typeof(this.callback.onSelectChanged) != "undefined") {
            //var index = Math.floor(this.vx.invert(x));
            var index = this.offset + x; 
            //console.log("_notifySelectChanged", "index", index, "x", x);
            this.callback.onSelectChanged(x, index);
        }
    }

    CanvasLineChart.prototype.setOffset = function (offset, update = false, notify = true, syncWithScrollBar = true) {
        this.max_length = this.showData ? d3.max(this.showData.lines, d => d.data.length) : 0;
        const max_offset = this.max_length - this.length;
        const can_scroll = this.max_length > this.length;
        if (!can_scroll) { 
            return;
        }


        if (offset == -1 || this.autoScroll) {
            offset = max_offset; // auto scrool to the end
        } else if (offset < 0) {
            offset = 0;
            if (update) {
                this.onScrollReachStart();
            }
        } else if (offset >= max_offset) {
            offset = max_offset;
            if (update) {
                this.onScrollReachEnd();
            }
        }

        if (offset != this.offset) {
            this.offset = offset;
            /* TODO: 这里有问题, 会导致onScrollBarScroll每次都return，可能和调用顺序和频率有关
            if (syncWithScrollBar && this.scrollBarElement) {
                this.preventScrollEvent = true;
                this.scrollBarElement.node().scrollLeft = this.offset;
            }
            */
            if (update) {
                this._initVisibleXScale();
                this.invalidate();
            }
            if (notify) {
                this._notifyOffsetChanged(offset);
                if (this.selectX != -1) {
                    this._notifySelectIndexChanged(offset + this.selectX);
                }
            }
        }
    }

    CanvasLineChart.prototype.onScrollReachStart = function () {
        console.debug("onScrollReachStart");
    }

    CanvasLineChart.prototype.onScrollReachEnd = function () {
        console.debug("onScrollReachEnd");
        if (this.callback && typeof(this.callback.onScrollReachEnd) != "undefined") {
            this.callback.onScrollReachEnd();
        }
    }

    CanvasLineChart.prototype._notifyOffsetChanged = function (offset) {
        //console.log("CanvasLineChart", "_notifyOffsetChanged", offset);
        if (this.callback && typeof(this.callback.onOffsetChanged) != "undefined") {
            this.callback.onOffsetChanged(offset);
        }
    }

    CanvasLineChart.prototype._notifySelectIndexChanged = function (selectIndex) {
        if (this.callback && typeof(this.callback.onSelectIndexChanged) != "undefined") {
            this.callback.onSelectIndexChanged(selectIndex);
        }
    }

    CanvasLineChart.prototype._initVisibleXScale = function () {
        var max_line_length = this.showData ? d3.max(this.showData.lines, d => d.data.length) : 0;
        this.max_length = max_line_length;
        //console.debug("max_line_length", max_line_length, "offset", this.offset);
        max_line_length -= this.offset;
        max_line_length = Math.min(max_line_length, this.length);

        this.vx = d3.scaleLinear().range([this.width - max_line_length , this.width]).nice(); // visible range
        //console.debug("vx.range", [this.width - max_line_length, this.width]);

        this.vx.domain([this.offset, max_line_length + this.offset]);
        //console.debug("vx.domain", [this.offset, max_line_length + this.offset]);
    }

    CanvasLineChart.prototype._initVisibleYScale = function () {
        var range_list = []
        this.showData.lines.forEach(line => {
            if (line.visibility) {
                range_list = range_list.concat(d3.extent(line.data));
            }
        });

        this.maxY = d3.max(range_list) * 1.1
        if (this.options.minY >= 0) {
            this.minY = this.options.minY;
        } else {
            this.minY = d3.min(range_list) * 0.9;
            if (this.minY < 0) {
                this.minY = 0;
            }
        }
        if (this.maxY == 0) {
            this.maxY = 1;
        }
        this.y.domain([this.minY, this.maxY]);
        //console.debug("y.range", [this.minY, this.maxY]);
    }

    CanvasLineChart.prototype._initColors = function () {
        this.color = d3.scaleOrdinal(this.showData.colors);
    }

    CanvasLineChart.prototype.notifyDataSetChanged = function () {
        this.invalidate();
    }

    CanvasLineChart.prototype.computeShowData = function(data) {
        if (this.options.areaModel && this.options.stackModel) {
            let lineCount = data.lines.length;
            if (lineCount > 1) {

                let copyData = {...data}
                copyData.lines = [];
                for (let index = 0; index < lineCount; index ++) {
                    copyData.lines.push({...data.lines[index]})
                    copyData.lines[index].data = [];
                }
            
                data.lines[0].data.forEach((item,index) => {
                    for (let i = 0; i < lineCount; i++) {
                        let count = 0
                        for (let j = lineCount - 1 ; j >= i; j--) {
                            count += data.lines[j].data[index];
                        }
                        // console.log("count",count)
                        copyData.lines[i].data[index] = count;
                    }
                })
                return copyData;
            }
        }

        return data;
    }

    CanvasLineChart.prototype.setData = function (data) {
        if (data != null) {
            this.realData = data;
        }else {
            this.realData = {Axis:[],lines:[],labels:{}, regions: []}
        }

        this.showData = this.computeShowData(this.realData);
        
        //this._initColors();
        this._initVisibleXScale();
        this._initVisibleYScale();
        this._updateScrollBar();

        this.dirty = true;
        return this;
    }




    // loop
    CanvasLineChart.prototype.draw = function () {
        if (!this.showData || !this.dirty) {
            //this.render();
            return;
        }

        //console.log("CanvasLineChart", "draw");

        // clear canvas
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.xAxis();
        if (this.options.areaModel){
            this.areas();
        } else {
            this.lines();
        }
        
        this.yAxis();
        this.labelLines();
        this.regions();
        this.selectLine();
        if (this.options.showDebugWindow) {
            this.debugWindow();
        }
        this.dirty = false;
    }

 
    CanvasLineChart.prototype.xAxis = function () {
        var context = this.context
            x = this.x,
            y = this.y,
            width = this.width,
            height = this.height,
            tickCount = this.width / 100,
            tickSize = 6,
            ticks = x.ticks(tickCount),
            tickFormat = x.tickFormat();

        context.beginPath();
        ticks.forEach(function (d) {
            context.moveTo(x(d), height);
            context.lineTo(x(d), height - tickSize);
        });
        context.lineWidth = 0.2;
        context.strokeStyle = "#eeeeee";
        context.stroke();

        //context.textAlign = "center";
        //context.textBaseline = "top";
        //ticks.forEach(function (d) {
        //    context.fillText(tickFormat(d), x(d), height - tickSize);
        //});
    }

    CanvasLineChart.prototype.yAxis = function () {
        var context = this.context,
            x = this.x,
            y = this.y,
            width = this.width,
            height = this.height,
            tickCount = 5,
            tickSize = 6,
            tickPadding = 3,
            ticks = y.ticks(tickCount),
            tickFormat = y.tickFormat(tickCount);

        // guide line
        context.beginPath();
        ticks.forEach(function (d) {
            context.moveTo(0, y(d));
            context.lineTo(width, y(d));
        });
        context.lineWidth = 0.1;
        context.strokeStyle = "#cccccc";
        context.stroke();

        const labelHeight = 16;
        const padding = 5;

        // top label
        var maxLabel = this.options.yAxisLabelFormat(this.maxY.toFixed(2)); 
        var labelWidth = context.measureText(maxLabel).width + (padding * 2);
        context.rect(0, 0, labelWidth, labelHeight);
        context.fillStyle = "rgba(100, 100, 100, 0.2)";
        context.fill();
        context.fillStyle = "#eeeeee";
        context.fillText(maxLabel, padding, labelHeight - padding)

        // bottom label
        var minLabel = this.options.yAxisLabelFormat(this.minY.toFixed(2));
        labelWidth = context.measureText(minLabel).width + (padding * 2);
        context.rect(0, this.height - labelHeight, labelWidth, labelHeight);
        context.fillStyle = "rgba(100, 100, 100, 0.2)";
        context.fill();
        context.fillStyle = "#eeeeee";
        context.fillText(minLabel, padding, this.height - padding);
    }

    CanvasLineChart.prototype.lines = function () {
        var context = this.context;
        this.showData.lines.forEach(line => {
            if (line.visibility) {
                //console.log("line", line.data);
                context.beginPath();
                this.line(line.data.slice(this.offset));
                context.lineWidth = typeof(line.lineWidth) != "undefined" ? line.lineWidth : this.options.lineWidth;
                context.strokeStyle = line.color;
                context.stroke();
                context.closePath();
            }
        });
    }

    CanvasLineChart.prototype.areas = function () {
        var context = this.context;


        this.showData.lines.forEach(line => {
            if (line.visibility) {
                //console.log("line", line.data);
                context.beginPath();
                this.line(line.data.slice(this.offset));
                context.fillStyle = line.color;
                context.fill();
                context.closePath();
            }
        });
    }



    CanvasLineChart.prototype.labelLines = function () {
        var ctx = this.context;
        if (!this.showData.labels) {
            return;
        }

        const padding = 5;
        const labelHeight = 16;

        this.clickableElements = []; // clear

        for (let frameIndex in this.showData.labels) {
            if (frameIndex > this.offset && frameIndex < this.max_length) {
                let labels = this.showData.labels[frameIndex];
                if (labels && labels.length > 0) {
                    let firstLabel = labels[0];
                    let x = frameIndex - this.offset;
                    //console.debug("label", firstLabel, "frameIndex", frameIndex - this.offset, "x", x);

                    // draw frame line
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, this.height);
                    ctx.lineWidth = this.options.frameLineWidth;
                    if (this.options.frameLineDash) {
                        ctx.setLineDash([2, 2]);
                    }
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
                    ctx.stroke();
                    ctx.closePath();
                    if (this.options.frameLineDash) {
                        ctx.setLineDash([]);
                    }

                    // draw label text
                    if (this.options.drawLabelText) {
                        var labelWidth = ctx.measureText(firstLabel).width + (padding * 2);
                        let y = labelHeight - padding;
                        ctx.rect(x, 0, labelWidth, labelHeight);
                        //ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
                        ctx.fillStyle = "rgba(161, 80, 169, 0.5)";
                        ctx.fill();
                        ctx.fillStyle = "#eeeeee";
                        x = x + padding;
                        ctx.fillText(firstLabel, x, y)

                        this.clickableElements.push({
                            rect : {
                                top: 0,
                                bottom: 0 + labelHeight,
                                left: x,
                                right: x + labelWidth
                            }, 
                            data: {
                                "type": "label",
                                "name": firstLabel
                            }
                        });
                    }
                }
            } else {
                // out of picture
            }
        }
    }

    CanvasLineChart.prototype.regions = function () {
        var ctx = this.context;
        if (!this.showData.regions || this.showData.regions.length === 0) {
            return;
        }

        const padding = 5;
        const labelHeight = 16;

        this.clickableElements = []; // clear

        //var gradient = ctx.createLinearGradient(20,0, 220,0);
        //gradient.addColorStop(0, "rgba(224, 130, 31, 0.4)");
        //gradient.addColorStop(1, "rgba(255, 130, 31, 0.4)");

        var region,
            x1,
            x2,
            y = 0,
            width,
            height = this.height,
            label;
        for (let i in this.showData.regions) {
            region = this.showData.regions[i];
            label = region.label;
            x1 = region.start - this.offset;
            x2 = region.end - this.offset + 1;
            width = x2 - x1;
            if (x2 < 0 || x1 > this.width || width <= 0) {
                continue; // out of screen
            }

            // draw region rect
            ctx.beginPath();
            ctx.fillStyle = "rgba(224, 130, 31, 0.4)";
            ctx.rect(x1, y, width, height);
            ctx.fill();

            // draw label text
            x = x1;
            if (this.options.drawLabelText) {
                var labelWidth = ctx.measureText(label).width + (padding * 2);
                let y = labelHeight - padding;

                ctx.fillStyle = "#eeeeee";
                x = x + padding;
                ctx.fillText(label, x, y)

                this.clickableElements.push({
                    rect: {
                        top: 0,
                        bottom: 0 + labelHeight,
                        left: x,
                        right: x + labelWidth
                    },
                    data: {
                        "type": "region",
                        "data": region
                    }
                });
            }
        }
    }

    CanvasLineChart.prototype.selectLine = function () {
        if (this.selectX == -1) {
            return;
        }

        var ctx = this.context;
        const formator = this.options.selectLineLabelFormat;

        // draw frame line
        ctx.beginPath();
        ctx.moveTo(this.selectX, 0);
        ctx.lineTo(this.selectX, this.height);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.stroke();

        const labelInfo = [];

        //context.fillStyle = context.strokeStyle;
        this.showData.lines.forEach(line => {
            if (line.visibility) {
                //var index = Math.floor(this.vx.invert(this.selectX));
                var index = this.offset + this.selectX;
                var value = line.data[index];
                //console.log(index, value);
                var y = this.y(value);
                value = formator(value);

                // draw text box
                labelInfo.push({
                    value: value,
                    x: this.selectX,
                    y: y,
                    width: ctx.measureText(value).width + 10,
                    height: 12,
                    color: line.color
                });
            }
        });

        let x;
        let y;
        labelInfo.sort((o1, o2) => (o1.value - o2.value)).forEach((info, index) => {
            x = index % 2 == 0 ? info.x : info.x - info.width; // even/odd -> left/right
            y = (Math.abs(y - info.y) < info.height / 2) ? info.y + (info.height / 2) : info.y;
            y -= (info.height / 2); // align center
            if (y <= 0) {
                y = info.height;
            } else if (y >= this.height - (info.height / 2)) {
                y = this.height - info.height;
            }

            ctx.beginPath();
            //ctx.rect(x, y, info.width, info.height);
            drawRoundRect(ctx, x, y, info.width, info.height, 5);
            ctx.fillStyle = "rgba(0, 0, 0, 1)";
            ctx.fill();

            // draw text
            ctx.fillStyle = info.color;
            ctx.fillText(info.value, x + 5, y + 10);
            // console.log("selectLine", info, y, this.height);
            //console.log("label", value, this.color(this.showData.xAxis[i]));
        });
    }

    CanvasLineChart.prototype.debugWindow = function () {
        var ctx = this.context;

        const debugBoxWidth = 150,
              debugBoxHeight = parseInt(this.height * 0.8),
              padding = 10,
              space = 2,
              textHeight = 12;
        var   x = this.width - debugBoxWidth,
              y = (this.height / 2) - (debugBoxHeight / 2);

        ctx.beginPath();
        ctx.rect(x, y, debugBoxWidth, debugBoxHeight);
        ctx.fillStyle = "rgba(20, 20, 20, 0.5)";
        ctx.fill();

        var text = "DEBUG INFO:";
        x += padding;
        y += padding;
        ctx.fillStyle = "rgba(0, 255, 0, 1)";
        ctx.fillText(text, x, y);

        y += textHeight + space;
        ctx.fillText("w/h: " + this.width + "," + this.height, x, y);

        y += textHeight + space;
        ctx.fillText("size: " + this.max_length, x, y);

        y += textHeight + space;
        ctx.fillText("range: " + this.vx.range(), x, y);

        y += textHeight + space;
        ctx.fillText("domain: " + this.vx.domain(), x, y);
   
        y += textHeight + space;
        ctx.fillText("offset: " + this.offset, x, y);

        y += textHeight + space;
        ctx.fillText("selectX: " + this.selectX, x, y);
    }

    CanvasLineChart.prototype.invalidate = function () {
        this.dirty = true;
        this.render();
    }

    CanvasLineChart.prototype.render = function () {
        if (!this.requestDrawing) {
            this.requestDrawing = true;
            requestAnimationFrame(() => {
                this.requestDrawing = false;
                this.draw();
            });
        }
    }

    CanvasLineChart.prototype.destroy = function () {
        this.showData = null;
    }

    window.CanvasLineChart = CanvasLineChart;
    // required for use with nodejs
    if (typeof module === 'object') {
        module.exports.CanvasLineChart = window.CanvasLineChart;
    }

})(window, d3);
