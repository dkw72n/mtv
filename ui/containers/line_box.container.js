import { connect } from 'react-redux'
import { setLineData } from '../actions/line.action'
import LineBox from "../components/line_box";

const mapStateToProps = (state, ownProps) => {
    //console.log("EventListContainer", "mapStateToProps", state, state.eventList);
    return {
        lineData: state.line.lineData,
        lineDataId: state.line.lineDataId,
        selectX: state.line.selectX,
    }
};

const mapDispatchToProps = (dispatch, ownProps) => ({
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(LineBox);
