(function(window, d3){

    const DEBUG = true;

    const LEVEL_IDX = 0;
    const NAME_IDX  = 1;
    const START_IDX = 2;
    const END_IDX   = 3;
    const PATH_IDX  = 4;
    const COLOR_IDX = 5;
    const TEXT_COLOR_IDX = 6;
    const HIGHLIGHT_IDX = 7;

    /*
    const luminanceThreshold = 0.2;
    function getLuminance(color) {
        return 0.2126 * (color.r/255) + 0.7152 * (color.g/255) + 0.0722 * (color.b/255);
    }
    */

    const luminanceThreshold = 70;
    function getLuminance(color) {
        color = d3.color(color);
        var yiq = ((color.r * 299) + (color.g * 587) + (color.b * 114)) / 1000;
        return yiq;// < 128);// ? 'white' : 'black';
    }

    var startMs = 0;
    function prefStart() {
        startMs = new Date().getTime();
    }
    function prefEnd(mark) {
        if (startMs != 0) {
            debug(mark + " cost time " + (new Date().getTime() - startMs) + " ms");
            startMs = 0;
        }
    }

    function truncateEnd(str, maxLength) {
        if (str.length <= maxLength) {
            return str;
        }
        return str.substr(0, maxLength - 1) + '\u2026';
    };

    function truncateMiddle(str, maxLength) {
        if (str.length <= maxLength) {
            return str;
        }
        let leftHalf = maxLength >> 1;
        let rightHalf = maxLength - leftHalf - 1;
        if (str.codePointAt(str.length - rightHalf - 1) >= 0x10000) {
            --rightHalf;
            ++leftHalf;
        }
        if (leftHalf > 0 && str.codePointAt(leftHalf - 1) >= 0x10000) {
            --leftHalf;
        }
        return str.substr(0, leftHalf) + '\u2026' + str.substr(str.length - rightHalf, rightHalf);
    };
    
    function generateHash(name) {
        // Return a vector (0.0->1.0) that is a hash of the input string.
        // The hash is computed to favor early characters over later ones, so
        // that strings with similar starts have similar vectors. Only the first
        // 6 characters are considered.
        //const MAX_CHAR = 106

        var hash = 0
        var maxHash = 0
        var weight = 1
        var mod = 10

        if (name) {
            for (var i = name.length - 1; i >= 0; --i) {
                //if (i > MAX_CHAR) { break }
                hash += weight * (name.charCodeAt(i) % mod)
                maxHash += weight * (mod - 1)
                weight *= 0.70
            }
            if (maxHash > 0) { hash = hash / maxHash }
        }
        return hash
    }

    function hashCode(str) {
        var hash = 0, i, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    };

    function drawExpansionArrow(context, x, y, expanded) {
        const _arrowSide = 8;
        const arrowHeight = _arrowSide * Math.sqrt(3) / 2;
        const arrowCenterOffset = Math.round(arrowHeight / 2);
        context.save();
        context.translate(x, y);
        context.rotate(expanded ? Math.PI / 2 : 0);
        context.moveTo(-arrowCenterOffset, -_arrowSide / 2);
        context.lineTo(-arrowCenterOffset, _arrowSide / 2);
        context.lineTo(arrowHeight - arrowCenterOffset, 0);
        context.restore();
    }

    function constrain(transform, viewportExtent, translateExtent) {
        var dx0 = transform.invertX(viewportExtent[0][0]) - translateExtent[0][0],
            dx1 = transform.invertX(viewportExtent[1][0]) - translateExtent[1][0],
            dy0 = transform.invertY(viewportExtent[0][1]) - translateExtent[0][1],
            dy1 = transform.invertY(viewportExtent[1][1]) - translateExtent[1][1];
        return transform.translate(
            dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
            dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
        );
    }

    function debug(...args) {
        if (DEBUG) {
            // console.log(...args);
        }
    }

   function formatXLabel(time, formatFunc) {
        time = formatFunc(time);
        if (time.endsWith(".0")) {
            time = time.substr(0, time.length - 2);
        }
        return time + " ms"
    }

    function TimeFlameGraph(elem, dataProvider, options) {
        this.elem = elem;
        this.dataProvider = dataProvider;
        this.options = Object.assign({
            margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            },
            rowHeight: 18,
            fontTopOffset: 1,
            minHeight: 500,
            textColor: "#ffffff",
            textColorDark: "#000000",
            lineColor: "#ffffff",
            highlightColor: "orange",
            //fontFamily: "Verdana, 'Segoe UI', Tahoma, sans-serif",
            fontFamily: "'Segoe UI', Tahoma, sans-serif",
            //fontFamily: "Consolas",
            fontSize: "12px",
            backgroundColor: "#1e1e1e",
            selectedColor: "#0a84ff",
            nanoTimeUnit: false,
            tickFormat: d3.format(".1f"),
            tooltipMsFormat: d3.format(">-.2f"),
            startZero: true,
            hashColor: this.hashColor,
            searcher: this.searcher,
            formatXLabel: formatXLabel,
            formatTooltipMsLabel: formatXLabel,
            zoomAnimDuration: 100,
        }, options);
        debug("options", this.options);

        this.highlightLineWidth = 2;
        this.lastIdx = -1;
        
        this._reset();

        window.addEventListener("resize", () => this.onResize());

        this.container = d3.select(this.elem)
            .classed("d3-time-flame-graph", true)
            .on("mousemove", this._onMouseMove.bind(this))
            .on("click", this._onClick.bind(this))
            .on("dblclick", this._onDblClick.bind(this));

        this.canvas = this.container.append("canvas")
            .classed("d3-time-flame-graph-canvas", true);

        this.scrollBar = this.container.append("div")
            .classed("d3-time-flame-graph-scroll-bar", true)
            .on("scroll", this.onScrollBarScroll.bind(this));
        this.scrollBarInner = this.scrollBar.append("div");

        this.highlightElem = this.container.append("div")
            .classed("d3-time-flame-graph-highlight", true)
            .style("display", "invisible");

        this.selectedElem = this.container.append("div")
            .classed("d3-time-flame-graph-selected", true)
            .style("display", "invisible")
            .style("outline-color", this.options.selectedColor);

        this.tooltipElem = this.container.append("div")
            .classed("d3-time-flame-graph-tooltip", true)
            .style("display", "invisible");
            
        this.tooltipMsElem = this.tooltipElem.append("div")
            .classed("d3-time-flame-graph-tooltip-ms", true);
        this.tooltipNameElem = this.tooltipElem.append("div")
            .classed("d3-time-flame-graph-tooltip-name", true);
     
        const parentSize = elem.parentNode.getBoundingClientRect();
        this._initWithSize(parentSize.width, parentSize.height);
        this.notifyDataSetChanged();

        this.callbacks = {};

        // TODO: for test
        /*
        setTimeout(() => {
            var transform = d3.zoomTransform(this.canvas.node());
            console.log("current transform", transform);
            this.canvas
                .transition().duration(750)
                .call(this.zoom.transform, d3.zoomIdentity.translate(-500, 0).scale(2));
        }, 1000);
        */
    }


    TimeFlameGraph.prototype._reset = function() {
        this.width = 0;
        this.height = 0;
        this.scrollHeight = 0;

        this.timelineLevels = null;
        this.highlightEntry = null;
        this.selectedEntry = null;
        this.dirty = false;

        this.startTime = 0;
        this.endTime = 0;

        this.threadCount = 0;

        this.x = null;
        this.scaleX = null;
        this.y = null;
        this.scaleY = null;
        this.ty = []; // thread y

        this.scrollTop = 0;
        this.maxScrollTop = 0;
        this.preventScrollEvent = false;

        this.mouseStartY = 0;
        this.mouseState = 0;
        this.transform = d3.zoomIdentity;

        //this.callbacks = {};
    }

    TimeFlameGraph.prototype.reset = function() {
        this._reset();

        const parentSize = this.elem.parentNode.getBoundingClientRect();
        this._initWithSize(parentSize.width, parentSize.height);
        this.notifyDataSetChanged();

        if (this.canvas && this.zoom && this.transform) {
            this.canvas.call(this.zoom.transform, this.transform);
        }
    }


    TimeFlameGraph.prototype.getData = function() {
        return this.dataProvider.getData();
    }

    TimeFlameGraph.prototype.on = function(eventType, callback) {
        if (typeof(this.callbacks[eventType]) == 'undefined') {
            this.callbacks[eventType] = [];
        }
        this.callbacks[eventType].push(callback);
    }

    TimeFlameGraph.prototype._notifyEvent = function(eventType, data) {
        if (typeof(this.callbacks[eventType]) != 'undefined') {
            this.callbacks[eventType].forEach(callback => {
                callback(data);
            });
        }
    }
 
    TimeFlameGraph.prototype._initWithSize = function(width, height) {
        const realWidth = width;
        const realHeight = height;
        this.scrollHeight = this._calHeight(this.options.rowHeight);
        this.maxScrollTop = this.scrollHeight - realHeight;

        const ratio = window.devicePixelRatio;
        this.width = Math.floor(realWidth * ratio);
        this.height = Math.floor(realHeight * ratio);
        debug("initWithWidth", "width", width, "ratio", ratio, "width/height", [this.width, this.height]);

        //this.container.style("width", (this.width / ratio) + "px");
        //this.container.style("height", (this.height / ratio) + "px");
        this.canvas
            .attr("width", this.width)
            .attr("height", this.height)
            .style("width", (realWidth) + "px")
            .style("height", (realHeight) + "px");

        this.zoom = d3.zoom()
            //.extent([[0, 0], [this.width / 2, 10]])
            //.constrain(constrain)
            .scaleExtent([1, Infinity])
            .translateExtent([[0,0], [this.width, this.height]])
            .on("zoom", this.zoomed.bind(this))
            .on("start", this.startZoom.bind(this))
            .on("end", this.endZoom.bind(this));
        this.canvas.call(this.zoom)
          .on("dblclick.zoom", null)
          .on("wheel.zoom", null)
          ;

        this.scrollBarInner.style("height", this.scrollHeight + "px");
    }
    
    TimeFlameGraph.prototype.scrollTopTo = function (scrollTop, syncWithScrollBar = true) {
        if (scrollTop < 0) {
            scrollTop = 0;
        } else if (scrollTop > this.maxScrollTop) {
            scrollTop = this.maxScrollTop;
        }
        this.scrollTop = scrollTop;
        this._initYAxis();

        if (syncWithScrollBar) {
            this.preventScrollEvent = true;
            this.scrollBar.node().scrollTop = this.scrollTop;
        }
        this._updateSelected();

        this._notifyEvent("scroll", [0, this.scrollTop]);
    }
    
    TimeFlameGraph.prototype.scrollTopBy = function (scrollBy) {
        this.scrollTopTo(this.scrollTop - scrollBy, true);
    }

    TimeFlameGraph.prototype.onScrollBarScroll = function (event) {
        if (this.preventScrollEvent) {
            this.preventScrollEvent = false;
            return;
        }

        debug("onScroll", event);
        this.scrollTopTo(this.scrollBar.node().scrollTop, false);
        this.invalidate();
    }

    TimeFlameGraph.prototype.zoomed = function () {
        debug("zoomed event", d3.event.transform,  d3.zoomTransform(this.canvas.node()),  d3.event.dx);
        this.transform = d3.event.transform;
        //this.transform = d3.zoomTransform(this);

        this.scaleX = this.transform.rescaleX(this.x);
        //this.scaleY = transform.rescaleY(this.y);

        // The scaleX has been changed, need to update highlight and selected div element's size and position
        this._updateHighlight(); 
        this._updateSelected();

        if (d3.event.sourceEvent) {
            this._onMouseEvent(d3.event.sourceEvent); 
        }

        //context.save();
        this.invalidate();
        //context.restore();
    }

    TimeFlameGraph.prototype.startZoom = function () {
        if (d3.event.sourceEvent) {
            this._onMouseEvent(d3.event.sourceEvent); 
        }
    }

    TimeFlameGraph.prototype.endZoom = function () {
        if (d3.event.sourceEvent) {
            this._onMouseEvent(d3.event.sourceEvent); 
        }
    }

    TimeFlameGraph.prototype.onResize = function (event) {
        debug("onResize");
        const parentSize = this.elem.parentNode.getBoundingClientRect();
        const scrollWidth = this.scrollBar.node().getBoundingClientRect().width;
        const parentWidth = parentSize.width - (scrollWidth / 2)

        this._initWithSize(parentWidth, parentSize.height);
        this._initXAxis();
        this._initYAxis();
        this._updateSelected();
        this.invalidate();
    }

    TimeFlameGraph.prototype._onMouseEvent = function (event) {
        if (event.type === "mousedown") {
            //console.log("mouseevent", "mousedown");
            this.mouseStartY = event.clientY; 
            this.mouseState = 1;
        } else if (event.type === "mousemove") {
            //console.log("mouseevent", "mousemove");
            if (this.mouseState === 1) {
                var diffY = event.clientY - this.mouseStartY;
                this.scrollTopBy(diffY);
                //console.log("mouseevent", "moveby", diffY, this.scrollTop);

                this.mouseStartY = event.clientY;
            }
        } else if (event.type === "mouseup") {
            //console.log("mouseevent", "mouseup");
            this.mouseState = 0;
        }
    }

    TimeFlameGraph.prototype.selectItem = function (entryIndex) {
        if (entryIndex) {
            const threadIndex = entryIndex[0];
            const dataIndex = entryIndex[1];
            const data = this.getData();
            if (threadIndex < data.length && dataIndex < data[threadIndex]['data'].length) {
                this.highlightEntry = {
                    data: data[threadIndex]['data'][dataIndex],
                    index: [threadIndex, dataIndex]
                };
                debug("highlightEntry", data, this.highlightEntry);
                this._onClick(false);
                this._onDblClick(false);
            } 
        } else {
            this.highlightEntry = null;
            this._onClick(false);
            this._onDblClick(false);
        }
    }
    
    TimeFlameGraph.prototype._onDblClick = function (anim = true){
        debug("onDblClick", d3.event);
        if (this.selectedEntry) {
            this.zoomToEntry(this.selectedEntry, anim);
        }
    }
    
    TimeFlameGraph.prototype._onClick = function (anim = true) {
        this.selectedEntry = this.highlightEntry;
        this._updateSelected();
        this._notifyEvent("click", this.selectedEntry);

        debug("onClick", d3.event);
        if (!d3.event) {
            return;
        }

        const entry = this._coordinatesToEntryIndex(d3.event.offsetX, d3.event.offsetY);
        if (entry != null && entry.type === 0 /* header */) {
            debug("onClick Header", entry.index);
            this._toggleThreadVisible(entry.index);
        }

        if (this.selectedEntry && d3.event && d3.event.ctrlKey === true) {
            this.zoomToEntry(this.selectedEntry);
        }
    }

    TimeFlameGraph.prototype._toggleThreadVisible = function (threadIndex) {
        if (this.getData() && threadIndex < this.getData().length) {
            this.getData()[threadIndex].expanded = !this.getData()[threadIndex].expanded;
            this._initYAxis();
            this.invalidate();
        }
    }

    TimeFlameGraph.prototype.zoomToEntry = function (entry, anim = true) {
        const width = this.x(entry.data[END_IDX]) - this.x(entry.data[START_IDX]);
        const newK = this.width / width * 1;
        const center = (this.x(entry.data[END_IDX]) + this.x(entry.data[START_IDX])) / 2
        
        debug("zoomToEntry", "width", width, "this.width", this.width, "newK", newK, "center", center);
        const rect = this._getEntryRect(entry);
        if (anim) {
            this.canvas.transition().duration(this.options.zoomAnimDuration)
                .call(this.zoom.transform, d3.zoomIdentity.scale(newK, [rect.x, rect.y]).translate(-this.x(entry.data[START_IDX]), 0))
                .on("end", () => {
                    /*
                    const rect = this._getEntryRect(entry);
                    var transform = d3.zoomTransform(this.canvas.node());
                    var transformX = -transform.x + rect.x;
                    var centerX = transformX - (this.width / 2) + (rect.width / 2);
                    var diffX = Math.abs((-transform.x) - (centerX)) / transform.k;
                    var dx = (-transform.x) > centerX ? diffX : -diffX;

                    var transformY = -transform.y + rect.y;
                    var centerY = transformY - (this.height / 2) + (rect.height / 2);
                    var diffY = Math.abs((-transform.y) - (centerY));
                    var dy = (-transform.y) > centerY ? -diffY : diffY;
            
                    debug("zoomToEntry", "x", -centerX, "dx", dx);
                    debug("zoomToEntry", "y", -centerY, "dy", dy);

                    this.canvas.transition().ease(d3.easeCircle).duration(75)
                        .call(this.zoom.translateBy, dx, 0) 
                        .on("end", () => {
                        debug("kkkkkkkkkk", this.scaleX(10000))
                        });
                    */
                });
        } else {
            this.canvas
                .call(this.zoom.transform, d3.zoomIdentity.scale(newK, [rect.x, rect.y]).translate(-this.x(entry.data[START_IDX]), 0))
        }


   
    }

    TimeFlameGraph.prototype._updateSelected = function () {
        //debug("_updateSelected", this.selectedEntry);
        if (this.selectedEntry != null) {
            debug("_updateHighlightOrSelectedElemStyle",this._getEntryRect(this.selectedEntry)) 
            this._updateHighlightOrSelectedElemStyle(this.selectedElem, this.selectedEntry);
        } else {
            this.selectedElem.style("display", "none")
        }
    }

    TimeFlameGraph.prototype._getEntryRect = function (entry) {
        let data = this.getData()[entry.index[0]]['data'][entry.index[1]]
        const x1 = this.scaleX(data[START_IDX]),
              x2 = this.scaleX(data[END_IDX]),
              y = this.ty[entry.index[0]](data[LEVEL_IDX]),
              width = x2 - x1,
              height = this.options.rowHeight;
        return {x: x1, y: y, width: width, height: height};
    }

    TimeFlameGraph.prototype._onMouseMove = function () {
        this.lastMouseOffsetX = d3.event.offsetX;
        this.lastMouseOffsetY = d3.event.offsetY;
        this._updateHighlight();
    }

    TimeFlameGraph.prototype._updateHighlightOrSelectedElemStyle = function (elem, entry, tooltipElem, tooltipMsElem, tooltipNameElem) {
        const rect = this._getEntryRect(entry); // TODO: 这里在重复计算rect的坐标, render里已经计算过了
        const minY = this.options.rowHeight; // the header

        var left = rect.x,
            right = rect.x + rect.width,
            top = rect.y,
            bottom = rect.y + rect.height,
            width = rect.width,
            height = rect.height;
        if (left < 0) { // 左侧超出屏幕
            width += left; 
            left = 0;
        }
        if (right > this.width) { // 右侧超出屏幕
            width -= (right - this.width);
            right = this.width;
        }
        if (top < minY) { // 上方超出屏幕
            height += top - minY;
            top = minY;
        }
        if (bottom > this.height) { // 下方超出屏幕
            height -= (bottom - this.height);
            bottom = this.height;
        }
        if (width < 0) {
            width = 0;
        }
        if (height < 0) {
            height = 0;
        }


        elem.style("display", width > 0 && height > 0 ? "block" : "none")
            .style("width", width + "px")
            .style("height", height + "px")
            .style("top", top + "px")
            .style("left",  left + "px");

        if (tooltipElem) {
            tooltipElem.style("display", "block");
            tooltipNameElem.text(entry.data[NAME_IDX]);
            let tooltipElemWidth = tooltipElem.node().getBoundingClientRect().width;
            
            let tooltipElemTop = this.lastMouseOffsetY + 10;
            if (tooltipElemTop < minY) {
                tooltipElemTop = minY;
            }
            let tooltipElemLeft = this.lastMouseOffsetX + 10;
            if (tooltipElemLeft + tooltipElemWidth > this.width) {
                tooltipElemLeft = this.width - tooltipElemWidth - 10 /* right padding */ - 13 /* scrollbar width */;
            }
            // console.log("tooltipElement", tooltipElemTop, tooltipElemLeft, tooltipElemWidth);
            tooltipElem.style("top", tooltipElemTop + "px")
                       .style("left", tooltipElemLeft + "px");

            tooltipMsElem.text(this.options.formatTooltipMsLabel(entry, entry.data[END_IDX] - entry.data[START_IDX], this.options.tooltipMsFormat));
        }
    }

    TimeFlameGraph.prototype._updateHighlight = function () {
        const entry = this._coordinatesToEntryIndex(this.lastMouseOffsetX, this.lastMouseOffsetY);
        // console.log("_updateHighlight", entry);
        if (entry != null && entry.type === 1 /* data */) {
            if (this.highlightEntry == null || this.highlightEntry.data !== entry.data) {
                this.highlightEntry = entry;
                this._updateHighlightOrSelectedElemStyle(this.highlightElem, this.highlightEntry, this.tooltipElem, this.tooltipMsElem, this.tooltipNameElem);
                this._notifyEvent("highlight", this.highlightEntry);
                // console.log("highlight", this.highlightEntry);
            }
        } else {
            if (this.highlightEntry) {
                this.highlightEntry = null;
                this.highlightElem.style("display", "none");
                this.tooltipElem.style("display", "none");
            }
        }
    }


    TimeFlameGraph.prototype._coordinatesToEntryIndex = function(offsetX, offsetY) {
        var entry = null;

        const { ty } = this;
        const { rowHeight } = this.options;

        //prefStart("_coordinatesToEntryIndex");
        var y, range, oy, level;
        var threadIndex = -1;
        for (let i = 0; i < ty.length; i++) {
            y = ty[i];
            range = y.range();
            if (range[0] <= offsetY && offsetY <= range[1]) {
                threadIndex = i;
                oy = offsetY - range[0];
                level = Math.floor(oy / rowHeight) - 1;
                if (-1 <= level && level < 0) {
                    if (offsetX < 200) {
                        entry = {};
                        entry.type = 0; // header
                        entry.data = "thread header";
                        entry.index = i;
                    }
                } else if (level >= 0) {
                    const indexes = this.timelineLevels[threadIndex][level];
                    if (indexes) {
                        var data;
                        const startTime = this.scaleX.invert(offsetX);
                        for (let l = 0; l < indexes.length; l++) {
                            data = this.getData()[ indexes[l][0] ]['data'][ indexes[l][1] ];
                            if (data[START_IDX] <= startTime && startTime <= data[END_IDX]) {
                                entry = {};
                                entry.type = 1; // data
                                entry.data = data;
                                entry.index = indexes[l];
                                //console.log("onMouseMove", "threadIndex", threadIndex, "level", level, "data", data);
                            }
                        }
                    }
                }
                break;
            }
        }
        //prefEnd("_coordinatesToEntryIndex");
        return entry;
    }


    TimeFlameGraph.prototype._initWithData = function() {
        this._processData(this.getData()); // TODO: 这里修改了原始数据, 应该改成不修改原始数据，将处理的数据另存

        this._initWithSize(this.width, this.height);
        this._initXAxis();
        this._initYAxis();
    }

    TimeFlameGraph.prototype._processData = function(data) {
        var startMs = new Date().getTime();
        var levelIndexes = [];
        if (data) {
            data.forEach((threadInfo, threadIndex) => {
                var threadLevelIndexes = [];
                var d;
                for (let i = 0, l = threadInfo.data.length; i < l; i++) { // loop data
                    d = threadInfo.data[i];
                    d[COLOR_IDX] = this.options.hashColor(d, 1, i);
                    d[TEXT_COLOR_IDX] = getLuminance(d[COLOR_IDX]) < luminanceThreshold;
                    if (typeof(threadLevelIndexes[d[LEVEL_IDX]]) == "undefined") {
                        threadLevelIndexes[d[LEVEL_IDX]] = [];
                    }
                    threadLevelIndexes[d[LEVEL_IDX]].push([threadIndex, i]);
                }
                threadLevelIndexes.forEach(levelList => {
                    levelList.sort((o1, o2) => o1[START_IDX] - o2[START_IDX]);
                });
                levelIndexes[threadIndex] = threadLevelIndexes;
            });
        }
        this.timelineLevels = levelIndexes;
        debug("pref", "processData cost", new Date().getTime() - startMs, "ms");
        return data;
    }

    TimeFlameGraph.prototype._forEach = function(walker) {
        if (this.getData()) {
            this.getData().forEach((threadInfo, threadIndex) => {
                for (let i = 0, l = threadInfo.data.length; i < l; i++) { // loop data
                    walker(threadIndex, i, threadInfo.data[i]);
                }
            });
        }
    }

    TimeFlameGraph.prototype.searcher = function(keyword, d) {
        if (d && d[NAME_IDX] && keyword) {
            return d[NAME_IDX].indexOf(keyword) != -1; 
        }
        return false;
    }

    TimeFlameGraph.prototype.search = function(keyword) {
        const { searcher } = this.options;
        let total = 0;
        let events = []
        this._forEach((threadIndex, dataIndex, data) => {
            let match = searcher(keyword, data);
            data[HIGHLIGHT_IDX] = match;
            if (match) {
                // total += (data[END_IDX] - data[START_IDX])
                events.push([data[END_IDX], -1])
                events.push([data[START_IDX], 1])
            }
        });
        events.sort((x,y) => {
          if(x[0] != y[0]) return x[0] - y[0];
          return y[1] - x[1];
        })
        let event_count = 0;
        let begin = 0;
        events.forEach(e=>{
          if (event_count == 0){
            begin = e[0];
          }
          event_count += e[1]
          if (event_count == 0){
            total += e[0] - begin;
          }
        })
        var interpolator = d3.interpolate(10, 2);
        this._transition(1000, d3.easeBounce, (t) => {
            this.highlightLineWidth = interpolator(t);
        });

        return total;
    }

    TimeFlameGraph.prototype._transition = function(duration, ease, func) {
        var timer = d3.timer((elapsed) => {
          // compute how far through the animation we are (0 to 1)
          const t = Math.min(1, ease(elapsed / duration));
        
          // update what is drawn on screen
          func(t);
          this.invalidate();
        
          // if this animation is over
          if (t === 1) {
            // stop this timer since we are done animating.
            timer.stop();
          }
        });
    }

    TimeFlameGraph.prototype._initXAxis = function() {
        const { width } = this;
        const data = this.getData();

        this.startTime = data ? d3.min(data, d => d.start_time) : 0;
        this.endTime = data ? d3.max(data, d => d.end_time) : 1000;

        this.x = d3.scaleLinear() 
            //d3.scaleTime()
            .range([0, width])
            .domain([this.startTime, this.endTime]);
        this.scaleX = this.transform.rescaleX(this.x);
        debug("x", "range(px)", this.x.range(), "domain(data)", this.x.domain());
    }

    TimeFlameGraph.prototype._initYAxis = function() {
        const { scrollTop } = this;
        const { rowHeight } = this.options;
        const data = this.getData();

        this.threadCount = data ? data.length : 0;

        this.y = d3.scaleOrdinal()
                .domain(d3.range(-1, this.threadCount + 1));
        var offset = -scrollTop;
        const range = [offset, offset + rowHeight];
        offset += rowHeight;
        this._forEachData((threadInfo, index) => {
            if (threadInfo.expanded) {
                offset += (threadInfo.max_level + 1 + 1 /* header */) * rowHeight;
            } else {
                offset += 1 /* header */ * rowHeight; // only show the header when it's been collapsed
            }
            range.push(offset);
        });
        this.y.range(range);
        this.scaleY = this.y.copy();

        debug("y", "range(px)", this.y.range(), "domain(data)", this.y.domain());

        this._initTYAxis();
    }

    TimeFlameGraph.prototype._forEachData = function(f) {
        if (this.getData()) this.getData().forEach(f);
    }

    TimeFlameGraph.prototype._initTYAxis = function() {
        this._forEachData((threadInfo, index) => {
            this.ty[index] = d3.scaleBand()
                            .range([this.scaleY(index), this.scaleY(index + 1)])
                            .domain(d3.range(-1 /* header */, threadInfo.max_level + 1));
            //debug("ty", "index", index, "band(px)", this.ty[index].bandwidth(), "range(px)", this.ty[index].range(), "domain(data)", this.ty[index].domain());
        });
    }

    TimeFlameGraph.prototype._calHeight = function(rowHeight) {
        var rows = 0;
        if (this.getData() != null) {
            rows = d3.sum(this.getData(), (d) => d.max_level + 1);
        }
        debug("_calHeight", "header", 1, "rows", rows, "rowHeight", rowHeight, "height", rowHeight * (rows + 1));
        var height = rowHeight * (rows + 1 /* header */);
        if (height < this.options.minHeight) {
            console.warn("_calHeight", "use min height", this.options.minHeight);
            height = this.options.minHeight;
        }
        return height;
    }

    TimeFlameGraph.prototype.notifyDataSetChanged = function () {
        this._initWithData();
        this.dirty = true;
        return this;
    }

    TimeFlameGraph.prototype.draw = function () {
        if (!this.dirty) {
            return;
        }
        debug("draw");

        const context = this.canvas.node().getContext("2d");
        const ratio = window.devicePixelRatio;
        context.save();
        context.scale(ratio, ratio);
        context.clearRect(0, 0, this.width, this.height);

        // draw background
        context.fillStyle = this.options.backgroundColor;
        context.fillRect(0, 0, this.width, this.height);

        this._drawXLines(context);
        this._drawYAxis(context);
        this._drawThreads(context);
        this._drawXAxis(context);

        this.dirty = false;
        debug("draw end");
        this._updateSelected();
    }

    TimeFlameGraph.prototype._drawXLines = function(context) {
        const { height } = this;
        const { lineColor } = this.options;

        var x = 0;
        context.lineWidth = 0.5;
        context.strokeStyle = lineColor;
        context.beginPath();
        this.scaleX.ticks(15).forEach(tick => {
            x = this.scaleX(tick);
            context.moveTo(x, 0);
            context.lineTo(x, height);
        });
        context.stroke()
    }
    
    TimeFlameGraph.prototype._drawXAxis = function(context) {
        const { startTime } = this;
        const { backgroundColor, lineColor, textColor, fontFamily, rowHeight, tickFormat, startZero } = this.options;

        //console.log("this.x.ticks(10)", this.x.ticks(10));
        var x = 0,
            padding = 6;

        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, this.width, rowHeight);

        context.lineWidth = 0.5;
        context.strokeStyle = lineColor;
        context.fillStyle = textColor;
        context.font="10px " + fontFamily;
        context.textBaseline = "top";
        context.beginPath();
        this.scaleX.ticks(15).forEach(tick => {
            x = this.scaleX(tick);
            context.moveTo(x, 0);
            context.lineTo(x, rowHeight);

            context.fillText(this.options.formatXLabel(startZero ? tick - startTime : tick, tickFormat), x + padding, 0 + padding);
        });
        context.stroke();
    }
    

    TimeFlameGraph.prototype._drawYAxis = function(context) {
    }

    TimeFlameGraph.prototype._drawThreads = function(context) {
        const { ty, width, highlightLineWidth } = this;
        const { highlightColor, textColor, textColorDark, lineColor, fontSize, fontFamily, rowHeight, fontTopOffset } = this.options;

        context.strokeStyle = lineColor;
        context.fillStyle = textColor;
        context.font="10px " + fontFamily;
        context.lineWidth = 0.5;
        //context.textAlign = "center";
        context.textBaseline = "top";

        const minTextWidth = context.measureText("\u2026").width;
        const charWidth = context.measureText("H").width;
        
        var y,
            rx1,            // rect start x
            rx2,            // rect end x
            ry,             // rect start y
            tx,             // text x
            tw,             // text room width
            text,
            textSize,
            textLength,
            rwidth,         // rect width
            rpadding = 1,   // rect padding
            rheight = rowHeight - /* bottom padding */ rpadding,
            tpadding = 5;   // text padding
        this._forEachData((threadInfo, index) => { // draw bar
            y = ty[index];
            
            var d, skipCount = 0, startMs = new Date().getTime();
            for (let i = 0, l = threadInfo.data.length; i < l; i++) { // loop data
                d = threadInfo.data[i];
                rx1 = this.scaleX(d[START_IDX]);
                rx2 = this.scaleX(d[END_IDX]) - /* right padding */ rpadding;
                rwidth = rx2 - rx1;
                if (rx2 < 0 || rx1 > this.width || rwidth < 0) {
                    skipCount++;
                    continue;
                }

                if (threadInfo.expanded) { // thread expanded
                    ry = y(d[LEVEL_IDX]);

                    // draw rect
                    context.beginPath();
                    context.fillStyle = d[COLOR_IDX];
                    context.rect(rx1, ry, rx2 - rx1, rheight);
                    context.fill();

                    if (d[HIGHLIGHT_IDX]) {
                        context.lineWidth = highlightLineWidth;
                        context.strokeStyle = highlightColor;
                        context.strokeRect(rx1, ry, rx2 - rx1, rheight);
                    }

                    // draw text
                    // textSize = context.measureText(d[NAME_IDX]);
                    tw = rwidth - (tpadding * 2);
                    tx = rx1 + tpadding;
                    if (tx < 0) {
                        tw += tx - tpadding;
                        tx = tpadding; // pin to left
                    }
                    textLength = Math.floor(tw / charWidth);
                    text = truncateMiddle(d[NAME_IDX], textLength);

                    if (tw > minTextWidth) {
                        context.beginPath();
                        context.fillStyle = d[TEXT_COLOR_IDX] ? textColor : textColorDark;
                        context.font = "500 " + fontSize + fontFamily;
                        context.fillText(text, tx, ry + fontTopOffset);
                        context.fill();
                    }
                } else { // thread collapsed
                    ry = y(-1);

                    // draw rect
                    context.beginPath();
                    context.fillStyle = d[COLOR_IDX];
                    context.rect(rx1, ry, rx2 - rx1, rheight);
                    context.fill();
                }
            }
            debug("pref",
                  "costMs", (new Date().getTime() - startMs), "ms",
                  "drawCount",  (threadInfo.data.length - skipCount),
                  "dataCount", threadInfo.data.length,
                  "skipCount", skipCount);
        });

        context.strokeStyle = lineColor;
        context.lineWidth = 0.5;
        context.font = "500 " + fontSize + fontFamily;
        //context.textBaseline = "middle";

        // draw thread header and line
        this._forEachData((threadInfo, index) => {
        y = ty[index];
        
        let threadNameWidth;
        y.domain().forEach(i => {
            var startX = 0; // pin to left
            if (i === -1) { // header
                // arrow
                context.fillStyle = textColor;
                context.beginPath();
                drawExpansionArrow(context, startX + 15, y(i) + rowHeight / 2, threadInfo.expanded);
                context.fill();

                // thread name
                context.beginPath();
                if (!threadInfo.expanded) {
                    textSize = context.measureText(threadInfo.thread_name);
                    threadNameWidth = textSize.width + 15 + 10 + 10;
                    if (threadNameWidth < 200) {
                        threadNameWidth = 200;
                    }
                    context.fillStyle = "rgba(50, 50, 50, 0.4)";
                    context.rect(startX, y(i), threadNameWidth, rowHeight);
                    context.fill();
                }
                context.fillStyle = textColor;
                context.fillText(threadInfo.thread_name, startX + 15 + 10, y(i) + fontTopOffset);

                // top border line
                context.beginPath();
                context.moveTo(startX, y(i) + 0.5);
                context.lineTo(width, y(i) + 0.5);
                context.stroke()
            } 
            /*
            if (DEBUG) {
                debug("draw line", i, 0, y(i)+ 0.5);
                context.beginPath();
                context.moveTo(0, y(i) + 0.5);
                context.lineTo(width, y(i) + 0.5);
                context.stroke();
            }
            */
        });
    });


    }

    // copy from https://github.com/sandin/d3-flame-graph/blob/master/src/flamegraph.js function colorHash()
    TimeFlameGraph.prototype.hashColor = function(d, alapa, idx) {
        const name = d[NAME_IDX];

        const hue = "warm";
        const vector = generateHash(name); // idx

        var r, g, b, a;
        // calculate color
        if (hue === 'red') {
            r = 200 + Math.round(55 * vector)
            g = 50 + Math.round(80 * vector)
            b = g
        } else if (hue === 'orange') {
            r = 190 + Math.round(65 * vector)
            g = 90 + Math.round(65 * vector)
            b = 0
        } else if (hue === 'yellow') {
            r = 175 + Math.round(55 * vector)
            g = r
            b = 50 + Math.round(20 * vector)
        } else if (hue === 'green') {
            r = 50 + Math.round(60 * vector)
            g = 200 + Math.round(55 * vector)
            b = r
        } else if (hue === 'aqua') {
            r = 50 + Math.round(60 * vector)
            g = 165 + Math.round(55 * vector)
            b = g
        } else if (hue === 'cold') {
            r = 0 + Math.round(55 * (1 - vector))
            g = 0 + Math.round(230 * (1 - vector))
            b = 200 + Math.round(55 * vector)
        } else {
            // original warm palette
            r = 200 + Math.round(55 * vector)
            g = 0 + Math.round(230 * (1 - vector))
            b = 0 + Math.round(55 * (1 - vector))
        }
        a = alapa;

        const color = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
        //console.log(name, vector, color);
        return color;
    }

    TimeFlameGraph.prototype.render = function () {
        requestAnimationFrame(() => {
            this.draw();
        });
    }
    
    TimeFlameGraph.prototype.invalidate = function () {
        this.dirty = true;
        this.render();
    }

    window.TimeFlameGraph = TimeFlameGraph;
    // required for use with nodejs
    if (typeof module === 'object') {
        module.exports.TimeFlameGraph = TimeFlameGraph;
    }

})(window, d3);
