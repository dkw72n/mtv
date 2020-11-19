export const SET_LINE_DATA = "SET_LINE_DATA";
export const SET_SELECT_X = "SET_SELECT_X";

export const setLineData = (lineData) => ({
    type: SET_LINE_DATA,
    lineData: lineData
});

export const setSelectX = (selectX) => ({
    type: SET_SELECT_X,
    selectX: selectX
});
