
export var DEBUG = false;

export const ENV = {
    isQT: typeof(window.qt) != "undefined",
    isChrome:  typeof(window.qt) === "undefined" && window.navigator.userAgent.indexOf("Chrome") != -1,
    isDevelopment: DEBUG
};

export const setDebugEnabled = function(enabled) {
    DEBUG = enabled;
}


export const schemeColors = [
    "#3a9afcEF",
    "#6acdfdEF",

    "#9ecc3a",
    "#ff00ff",
    "#38bcc9",
    "#3838d8",
    "#fcd319",
    "#e52128",
    "#f4911c",
    "#903f98",
    "#ee609d",
    "#ab0d15",
    "#7f007f",
    "#0071bc",
    "#fff200"
]