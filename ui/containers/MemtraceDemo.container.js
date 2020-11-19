import { connect } from 'react-redux'
import { setLineData, setSelectX } from '../actions/line.action'
import MemtraceDemo from "../components/MemtraceDemo";

const mapStateToProps = (state, ownProps) => {
    //console.log("EventListContainer", "mapStateToProps", state, state.eventList);
    return {
    }
};

const mapDispatchToProps = (dispatch, ownProps) => ({
    setLineData: (lineData) => dispatch(setLineData(lineData)),
    setSelectX: (selectX) => dispatch(setSelectX(selectX)),
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(MemtraceDemo);
