import { SET_LINE_DATA, SET_SELECT_X } from '../actions/line.action'
import { schemeColors } from "../constants";

const initialState = {
    lineData: {
        xAxis: [],
        labels: { "50": ["游戏启动(50)"], "2000": ["场景切换(2000)"] },
        lines: [
            { id: "cpu", name: "CPU", lineWidth: 3, color: schemeColors[0], visibility: true, data: [1] },
            { id: "gpu", name: "GPU", lineWidth: 1, color: schemeColors[1], visibility: true, data: [1] }
            // {id:"fps",name:"FPS",color: schemeColors[2], visibility:true,data:this.fpsList},
        ],
        regions: [
            /*
              {label:"flameGraph",id:1,start:10,end:100},
              {label:"flameGraph1",id:2,start:200,end:300},
              {label:"flameGraph2",id:3,start:500,end:1000}
            */
        ]
    },
    lineDataId: 0,
    selectX: 0,
};

const lineReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_LINE_DATA:
            // console.log("lineReducer, set line data", action.lineData);
            return {
                ...state,
                lineData: action.lineData,
                lineDataId: ++state.lineDataId, // force to update UI
            };
        case SET_SELECT_X:
            return {
                ...state,
                selectX: action.selectX
            };
        default:
            return state
    }
}

export default lineReducer
