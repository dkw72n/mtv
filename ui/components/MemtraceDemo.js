import React from "react"
import TimeFlameGraphComponent from "../tpt/components/time-flame-graph/TimeFlameGraph"
import LineChart from "../tpt/components/line-chart/LineChart"
import seedrandom from 'seedrandom';
import { FunctionColors, ENV } from "../constants"
import { Button, ButtonGroup, Spinner, Dropdown, ToggleButton, OverlayTrigger, Tooltip, Modal, Form, Row, Col } from 'react-bootstrap';
import styles from "./app.css";
import ToolBar from "./toolbar";
import LineBox from "../containers/line_box.container";
import SaveModal from "./save_modal"
import { schemeColors } from "../constants";

const framegraphMode = {
    ABSOLUTE: 1,
    DIFF: 2
}

function formatXLabel(time, formatFunc) {
    if (time < 1024) {
        time = formatFunc(time)
        return time + " B"
    }
    time /= 1024
    if (time < 1024) {
        time = formatFunc(time)
        return time + " KB"
    }
    time /= 1024
    time = formatFunc(time)
    return time + " MB"
}


function findIndexById(data, id) {
    if (data) {
        for (let i = 0; i < data.length; i++) {
            //console.log("findINdexById", data[i][4], id);
            if (data[i][4] == id) {
                return i;
            }
        }
    }
    return -1;
}


function formatMemory(memory) {
    return formatXLabel(memory, d3.format(">-.2f"));
}

export default class MemtraceDemo extends React.Component {

    constructor(props) {
        super(props)
        this.onItemClick = this.onItemClick.bind(this);
        this.onItemHighlight = this.onItemHighlight.bind(this);
        this.handleCheck = this.handleCheck.bind(this);
        this.handleDeltaCheck = this.handleDeltaCheck.bind(this);
        this.hashColor = this.hashColor.bind(this);
        this.colorMap = {};
        this.colorMapCount = 0;
        this.searchAutocompleteList = [];
        this.last_entry = null;
        this.highlight_fetching = false;
        this.highlight_pending = "";
        this.port = null; // TODO: new URLSearchParams(props.location.search).get("port")
        if (!this.port) {
            this.port = 9001;
        }
        // console.log("bbbbbbbbbbbb", props)
        this._line_data = {
            xAxis: [],
            labels: { "50": ["游戏启动(50)"], "2000": ["场景切换(2000)"] },
            lines: [
                { id: "cpu", name: "CPU", lineWidth: 3, color: schemeColors[0], visibility: true, data: [1] },
                { id: "gpu", name: "GPU", lineWidth: 1, color: schemeColors[1], visibility: true, data: [1] },
                // {id:"fps",name:"FPS",color: schemeColors[2], visibility:true,data:this.fpsList},
            ],
            regions: [
                /*
                  {label:"flameGraph",id:1,start:10,end:100},
                  {label:"flameGraph1",id:2,start:200,end:300},
                  {label:"flameGraph2",id:3,start:500,end:1000}
                */
            ]
        }

        this.state = {
            checked: false, // is Diff
            deltaChecked: false, // is delta mode
            loading: false,
            centerLoading: false,
            showRemoteModal: true,
            showLoadingModal: false, 
            reportName: null,
            searchVal: null,
            searchResult: null,
            captureDir: null,
            showScreenshot: false,
            screenshotPosition: "-999px",
            screenshotWidth: 0,
            screenshotHeight: 0,
            saveShow: false,
        };

        this._lastIndex = -1;

        this.useDeltaUrl = false;

        this.offset = 0
        this.framegraphMode = framegraphMode.ABSOLUTE
        this._line_last_idx = 0;
        this._rect_data_bak = { data: [] }
        this._rect_data_cur = { data: [] }
        this._rect_data = [{
            thread_name: "thread_15200",
            start_time: 3176184875,
            max_level: 256,
            expanded: true,
            end_time: 3176185514,
            id: 0,
            data: [
                [7, "Class7C07<int, int>::MethodD549", 3176184875, 3176184876, "\\src\\path\\df2f\\8c3d.cpp::641", "rgb(74, 228, 35)", false],]
        }]
        this._dataProvider = {
            getData: () => {
                return this._rect_data
            },
        };

        this._loaded = false;

        this._ref = React.createRef();
        this._inputRef = React.createRef();
        this.flameGraphRef = React.createRef();
        this._canvasRef = React.createRef();
        this.context = null;
        this._onFilesDrop = this._onFilesDrop.bind(this);
        

        this._diff_table = [];
        this._max_diff = 1;

        this.formatTooltipMsLabel = this.formatTooltipMsLabel.bind(this);
        this.onSearchChange = this.onSearchChange.bind(this)
    }

    formatTooltipMsLabel(entry, time, formatFunc) {
        let index = entry.index;
        if (this.state.checked) { // isDiff
            let diffValue = this._diff_table[index[1]] < 0 ? `-${formatXLabel(-this._diff_table[index[1]], formatFunc)}` : `+${formatXLabel(this._diff_table[index[1]], formatFunc)}`;
            return `${formatXLabel(time, formatFunc)}(${diffValue})`;
        } else {
            return formatXLabel(time, formatFunc);
        }
    }

    _onUrlBtnClicked() { // download file
        this.setState({ showRemoteModal: false });
        let deltaChecked = false;
        this.useDeltaUrl = deltaChecked; 
        this.setState({
            reportName: "demo",
            deltaChecked: deltaChecked
        });
        this._mayLoadData();
    }

    _onFilesDrop(ev) {
        console.log('On Multiple Symbol Files Drop', ev, ev.data);
        ev.preventDefault();
        ev.stopPropagation();

        if (ev.data && ev.data.length > 0) {
            let files = [...ev.data];
            console.log("files", files);
            this.setState({ showRemoteModal: false });
            this.setState({ loading: true });
            RPC.invoke("open_file", { files: files }).then(result => {
                if (result && result.ok ) {
                    console.log("result", result);
                    let deltaChecked = result.data ? result.data.isSample: false;
                    this.useDeltaUrl = deltaChecked;
                    this.setState({
                        reportName: result.data ? result.data.reportName: null,
                        deltaChecked: deltaChecked,
                        captureDir: result.data && result.data.captureDir ? result.data.captureDir: null,
                    });
                    this.port = result.data ? result.data.port: 9001;
                    this._mayLoadData();
                } else if (result.msg == '未选择文件') {
                    //TODO : 不做处理
                }
                else {
                    alert("导入报告失败");
                }
            }).catch((err) => {
                console.log('err', err);
                alert("导入报告失败");
            });
        }
    }

    _onLoadBtnClicked() {
        this.setState({ showRemoteModal: false });
        RPC.invoke("import_file").then(result => {
            if (result && result.ok) {
                console.log("result", result);
                let deltaChecked = result.data ? result.data.isSample: false;
                this.useDeltaUrl = deltaChecked;
                this.setState({
                    reportName: result.data ? result.data.reportName: null,
                    deltaChecked: deltaChecked,
                    captureDir: result.data && result.data.captureDir ? result.data.captureDir: null,
                });
                this.port = result.data ? result.data.port: 9001;
                this._mayLoadData();
            } else if (result.msg == '未选择文件') {
                //TODO : 不做处理
            }
            else {
                alert("导入报告失败");
            }
        }).catch((err) => {
            console.log('err', err);
            alert("导入报告失败");
        });
    }

    _getBaseUrl() {
        let url;
        if (this.useDeltaUrl) {
            url = `http://127.0.0.1:${this.port}/delta`;
        } else {
            url = `http://127.0.0.1:${this.port}/line`;
        }
        // console.log("getBaseUrl", url);
        return url;
    }

    _mayLoadData() {
        this.setState({ loading: true });
        const startTime = new Date().getTime();
        this._loaded = false;
        var timer = setInterval(() => {
            if (new Date().getTime() - startTime > 5 * 60 * 1000) {
                this.setState({ loading: false });
                alert("载入报告超时");
                clearInterval(timer);
                return;
            }

            fetch(`${this._getBaseUrl()}/0/0`).then(response => {
                this.setState({ loading: false });
                //if (!this._loaded) {
                    this._loadData();
                    clearInterval(timer);
                    //alert("成功导入报告");
                    this._loaded = true;
                //}
            }).then(error => console.error(error));
        }, 1000);
    }

    _onCloudBtnClicked() {
        this.setState({ showRemoteModal: true });
    }

    componentDidMount() {
        //this._loadData();
        this._ref.current.addEventListener("qtDrop", this._onFilesDrop);
        this._onUrlBtnClicked();
    }

    componentWillUnmount() {
        this._ref.current.removeEventListener("qtDrop", this._onFilesDrop);
        window.removeEventListener("message", this._onMessage);
    }

    _loadData() {
        //if (!this._loaded) {
        //    return;
        //}

        this.setState({ loading: true });
        let w = document.getElementById("chart_id").width;
        // console.log("loadData", w);
        fetch(`${this._getBaseUrl()}/0/${w}`)
            .then(response => {
                this.setState({ loading: false });
                response.json().then(data => {
                    // console.log("1++++++++++++", data)
                    this._line_data.lines[0].data = data;
                    this.props.setLineData(this._line_data);

                    this.onSelectChanged(w, Math.floor(w / 2));
                })
            }).catch(error => {
                this.setState({ loading: false });
                alert(error);
            });
    }

    onItemClick(entry) { // 当矩形框被点击的时候（鼠标click）
        // console.log("===============onItemClick", entry);
        if (!entry)
            return;
        var index = entry.data[4]
        let w = document.getElementById("chart_id").width;
        if (!index) index = 0;
        this._lastIndex = index;
        this.setState({ centerLoading: true });
        fetch(`${this._getBaseUrl()}/${index}/${w}`)
            .then(response => {
                this.setState({ centerLoading: false });
                response.json().then(data => {
                    // console.log("2++++++++++++", data)
                    this._line_data.lines[0].data = data;
                    this.props.setLineData(this._line_data);
                })
            }).catch(error => {
                this.setState({ centerLoading: false });
                alert(error);
            });
    }

    _highlight_get_line(what) {
        if (this.highlight_fetching) {
            this.highlight_pending = what;
            return;
        }
        if (!what) {
            return;
        }
        this.highlight_fetching = true;
        //this.setState({ centerLoading: true });
        let w = document.getElementById("chart_id").width;
        // console.log("==============_highlight_get_line", what, w);
        fetch(`${this._getBaseUrl()}/${what}/${w}`)
            .then(response => {
                //this.setState({ centerLoading: false });
                response.json().then(data => {
                    this._line_data.lines[1].data = data;
                    // console.log("2++++++++++++", this._line_data, data)
                    this.props.setLineData(this._line_data);
                    this.highlight_fetching = false;
                    setTimeout(() => {
                        var w = this.highlight_pending;
                        this.highlight_pending = null;
                        this._highlight_get_line(w);
                    }, 0);
                })
            }).catch(error => {
                //this.setState({ centerLoading: false });
            });
    }

    onItemHighlight(entry) { // 当矩形框被高亮的时候（鼠标over）
        // console.log("===============onItemHighlight", entry);
        if (this.last_entry != entry && d3.event.ctrlKey != true) {
            this.last_entry = entry;
            /*
            var index = entry.data[4]
            fetch(`${this._getBaseUrl()}/${index}/1920`)
            .then(response => {
                response.json().then(data => {
                  console.log("2++++++++++++", data)
                  this._line_data.lines[1].data = data;
                  this.setState({
                    linedata: this._line_data
                  });
                })
            })
            */
            this._highlight_get_line(entry.data[4])
        }
    }

    hashColor(d, alapa, idx) {
        const name = d[1]; // TODO: use id
        const value = d[3] - d[2];
        if (this.state.checked && this._diff_table.length > idx){
          let df = 0;
          let ratio = 0.1;
          if (this._diff_table[idx] != 0){
            df = (Math.atan2(this._diff_table[idx] * 3, this._max_diff * 0.8) + ratio) / (Math.PI/2 + ratio);
          }
          return this._getDiffColor(df);
        }
        return this._getHashColor(name, value);
    }

    _genDiffTable(){
        var i, j = 0;
        var max_diff = 1;
        this._diff_table = []
        for(i = 0; i < this._rect_data_cur.data.length; ++i){
          while(j < this._rect_data_bak.data.length && this._rect_data_bak.data[j][4] < this._rect_data_cur.data[i][4]){
            j++;
          }
          let w_cur = this._rect_data_cur.data[i][3] - this._rect_data_cur.data[i][2]
          let df = w_cur;
          if (j < this._rect_data_bak.data.length && this._rect_data_bak.data[j][4] == this._rect_data_cur.data[i][4]){
            let w_bak = this._rect_data_bak.data[j][3] - this._rect_data_bak.data[j][2]
            df = w_cur - w_bak;
          }
          if (Math.abs(df) > max_diff) max_diff = Math.abs(df);
          this._diff_table.push(df);
        }
        this._max_diff = max_diff;
      }

    _getDiffColor(df){
        var color;
        let r = 0.9
        let s = 0.3
        let t = 0.55
        if (df > 0){
          color = d3.rgb((df * (1-r) + r) * 255, (r - df * r * t) * 255, (r - df * r) * 255);
        } else {
          df = -df
          color = d3.rgb((r - df * r) * (1-df*s) * 255, (r - df * r * t) * (1-df*s) * 255, (df * (1-r) + r) * (1-df*s) * 255);
        }
        return color.toString();
      }

    _getHashColor(name, value) {
        if (typeof (this.colorMap[name]) == "undefined") {
            this.colorMap[name] = this.colorGenerator(name);
            this.colorMapCount++;
            this.searchAutocompleteList.push({ name: name, color: this.colorMap[name], value: value });
        }
        return this.colorMap[name];
    }

    colorGenerator(name) {
        var rnd = seedrandom(name);
        var color;
        do {
            color = d3.rgb(rnd() * 255, rnd() * 255, rnd() * 255);
        } while (this.getLuminance(color) < 100);
        return color.toString();
    }

    getLuminance(color) {
        color = d3.color(color);
        var yiq = ((color.r * 299) + (color.g * 587) + (color.b * 114)) / 1000;
        return yiq;
    }

    generate_rect_data_by_mode() {
        return this._rect_data_cur;
    }

    onSelectChanged(x, index) { // onLineItemClick
        if (!this._loaded) {
            return;
        }
        this.props.setSelectX(x);
        this.autoScroll = false;
        // console.log("lineChart", "onSelectChanged", x, index);
        let w = document.getElementById("chart_id").width;
        this.setState({ centerLoading: true });
        fetch(`http://127.0.0.1:${this.port}/rect/${index}/${w}`).then(response => {
            this.setState({centerLoading: false});
            response.json().then(data => {
                // console.log("------------", data)
                this._rect_data_bak = this._rect_data_cur
                this._rect_data_cur = data
                this._genDiffTable()
                this._rect_data[0] = this.generate_rect_data_by_mode()
                this._rect_data[0].id++
                this.setState({})
                if (this._lastIndex != -1 && this._rect_data[0] && this._rect_data[0].data) {
                    let index = findIndexById(this._rect_data[0].data, this._lastIndex);
                    //setTimeout(() => {
                        if (this.flameGraphRef.current) {
                            // console.log("this.flameGraphRef.current.selectItem", this._rect_data[0].data, index);
                            if (index == -1) index = 0;
                            this.flameGraphRef.current.selectItem([0, index]);
                            //this.flameGraphRef.current.selectItem([0, 0]);
                        }
                    //}, 50);
                }
            })
        }).catch(error => {
            this.setState({centerLoading: false});
            alert(error);
        });

        fetch(`http://127.0.0.1:${this.port}/timestamp/${index}/${w}`).then(response => {
            response.json().then(data => {
                var timestamp = data;
                // console.log("timestamp", timestamp);
                if (this.state.captureDir) {
                    RPC.invoke("get_screenshot", {timestamp: timestamp}).then(response => {
                        if (response.ok) {
                            console.log("截图", response.screenshot);
                            let img = new Image();
                            img.src = response.screenshot;
                            img.onload = () => {
                                console.log("截图加载好");
                                const bodywidth = this._ref.current.offsetWidth;
                                if (x + img.width/2 > bodywidth) {
                                    x = bodywidth - img.width/2;
                                }
                                this.setState({
                                    showScreenshot: true,
                                    screenshotPosition: x,
                                    screenshotWidth: img.width,
                                    screenshotHeight: img.height,
                                });
                                this.drawImage(img, 0, 0, img.width/2, img.height/2)
                            };
                        }
                    })
                }
            });
        }).catch(error => {
            alert(error);
        });

        let lli = this._line_last_idx
        this._line_data.labels = {}
        this._line_data.labels[lli] = ["past"]
        // this._line_data.labels[index] = ["current"]
        this._line_last_idx = index
    }

    drawImage(img, x, y, width, height) {
        this._canvasRef.current.getContext("2d").clearRect(0, 0, this._canvasRef.current.width, this._canvasRef.current.height);
        this._canvasRef.current.getContext("2d").drawImage(img, x, y,  width,  height);
    }

    onOffsetChanged(offset) {
        //this.offset = offset;
        console.log("lineCahrt", "onOffsetChanged", offset)
    }

    onAutoScrollChanged(autoScroll) {
        // console.log("lineCahrt", "onAutoScrollChanged", autoScroll)
    }

    onSelectIndexChanged(selectIndex) {
        console.log("lineCahrt", "onSelectIndexChanged", selectIndex)
    }

    onLabelClicked(label) {
        console.log("lineChart", "onLabelClicked", label)
    }

    onStartMoving() {
        console.log("lineChart", "startMoving")
    }

    onScrollReachEnd() {
        console.log("lineChart", "onScrollReachEnd")
        //this.autoScroll = true;
    }

    onSearchClick() {
        const keyword = this.state.searchVal;
        const total = this.flameGraphRef.current.search(keyword);
        // console.log("total", total);
        if (total > 0) {
            this.setState({searchResult: "Found " + formatMemory(total)});
        } else {
            this.setState({searchResult: null});
        }
    }

    onSearchChange(e) {
        this.setState({
            searchVal: e.target.value
        })
    }

    onMouseOut() {
        /*
        this.setState({
            showScreenshot: false
        })
        
        console.log("showScreenshot", this.state.showScreenshot)
        */
    }

    onMouseOver() {
      /*
        this.setState({
            showScreenshot: true
        })
        console.log("showScreenshot", this.state.showScreenshot)
      */
    }

    handleCheck() {
        this.setState({ checked: !this.state.checked });
    }

    handleDeltaCheck() {
        let deltaChecked = !this.state.deltaChecked;
        this.useDeltaUrl = deltaChecked;
        this.setState({ deltaChecked: deltaChecked});
        this._mayLoadData(deltaChecked);
    }

    onSaveClose() {
        this.setState({
            saveShow: false
        })
    }

    onSaveShow() {
        if (this.state.reportName) {
            this.setState({
                saveShow: true
            })
        }
    }

    render() {
        // console.log("render", "deltaChecked", this.state.deltaChecked, this.state.searchResult);
        return (
            <div ref={this._ref} style={{ height: "100%", display: "flex", "flexDirection": "column" }}>

                <div className={styles.topBar}>
                    <ToolBar
                        loading={this.state.loading}
                        centerLoading={this.state.centerLoading}
                        onLoadBtnClicked={() => this._onLoadBtnClicked()}
                        onCloudBtnClicked={() => this._onCloudBtnClicked()}
                        handleCheck={this.handleCheck}
                        checked={this.state.checked}
                        handleDeltaCheck={this.handleDeltaCheck}
                        deltaChecked={this.state.deltaChecked}
                        reportName={this.state.reportName}
                        onSearchChange={(e) => this.onSearchChange(e)}
                        searchVal={this.state.searchVal}
                        searchResult={this.state.searchResult}
                        onSearchClick={() => this.onSearchClick()}
                        onSaveShow={() => this.onSaveShow()}
                    />
                </div>

                <LineBox
                    onMouseOut={(e)=>{}}
                    onMouseOver={(e)=>{}}
                    offset={this.offset}
                    autoScroll={false}
                    options={{ drawLabelText: false, showDebugWindow: false, areaModel: true, frameLineWidth: 5, frameLineDask: false, selectLineLabelFormat: formatMemory, yAxisLabelFormat: formatMemory }}
                    showScrollBar={true}
                    onSelectChanged={(x, index) => this.onSelectChanged(x, index)}
                    onOffsetChanged={(offset) => this.onOffsetChanged(offset)}
                    onAutoScrollChanged={(autoScroll) => this.onAutoScrollChanged(autoScroll)}
                    onSelectIndexChanged={(selectIndex) => this.onSelectIndexChanged(selectIndex)}
                    onLabelClicked={(label) => this.onLabelClicked(label)}
                    onStartMoving={() => this.onStartMoving()}
                    onScrollReachEnd={() => this.onScrollReachEnd()}
                />
                <canvas ref={this._canvasRef} onMouseOut={() => this.onMouseOut()} onMouseOver={() => this.onMouseOver()} style={{
                    position: 'absolute',
                    display: this.state.showScreenshot ? "block" : "none",
                    top: "150px",
                    width: this.state.screenshotWidth/2 + "px",
                    height: this.state.screenshotHeight/2 + "px",
                    left: this.state.screenshotPosition + "px",
                    zIndex: "999",
                }}> </canvas>
                <div style={{ width: "100%", display: "flex", flex: "1 1 auto" }}>
                    <div style={{ width: "100%", flex: "1 1 auto" }}>
                        <TimeFlameGraphComponent ref={this.flameGraphRef} id="fg_id" dataProvider={this._dataProvider} options={{ hashColor: this.hashColor, fontTopOffset: 5, formatXLabel: formatXLabel, formatTooltipMsLabel: this.formatTooltipMsLabel, fontTopOffset: ENV.isChrome ? 5 : 2 }} itemClick={this.onItemClick} itemHighlight={this.onItemHighlight} />
                    </div>
                </div>


                {this.state.saveShow &&
                    <SaveModal onClose={() => this.onSaveClose()} />
                }

            </div>
        );
    }
}



