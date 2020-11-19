import React from 'react';

import { Modal, ListGroup, Spinner, Form, Row, Col, Button } from 'react-bootstrap';

const IP_PATTERN = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;


/**
 * 保存对话框
 */
export default class SaveModal extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            uploadChecked: false,
            saveChecked: true,
            confirmBtnEnabled: true,
            SODir: null,
            reportFilePath: null,
        };
        this.onConfirmBtnClick = this.onConfirmBtnClick.bind(this);
    }

    componentDidMount() {
        RPC.invoke("get_default_save_file").then(response => {
            if (response && response.ok && response.data) {
                const reportFilePath = response.data;
                this.setReportFilePath(reportFilePath)
            }
        }).catch(error => alert(error));
    }

    onConfirmBtnClick() {
        this.setState({
            confirmBtnEnabled: false
        });
        RPC.invoke("quadraticAnalysis", {outpath: this.state.reportFilePath, sopath: this.state.SODir}).then(response => {
            if (response.ok) {
                this.props.onClose()
            } else {
                alert(response.msg)
            }
        })
    }

    setReportFilePath(value) {
        this.setState({
            reportFilePath: value
        })
    }

    onReportFilePathClick() {
        RPC.invoke("choose_save_file", {filename: this.state.reportFilePath}).then(response => {
            if (response && response.ok && response.data) {
                const reportFilePath = response.data;
                this.setReportFilePath(reportFilePath)
            }
        }).catch(error => alert(error));
    }

    onSODirClick() {
        RPC.invoke("choose_so_dir").then(response => {
            if (response && response.ok && response.data) {
                const SODir = response.data;
                this.setState({
                    SODir: SODir
                });
            }
        }).catch(error => alert(error));
    }

    render() {
        return (
            <div>
                <Modal
                    backdrop={false}
                    keyboard={false}
                    show={true}
                    onHide={() => this.props.onClose()}
                    aria-labelledby="example-modal-sizes-title-lg">
                    <Modal.Header closeButton>
                        <Modal.Title id="example-modal-sizes-title-lg" style={{ marginLeft: "6px", fontWeight:600}}>
                            {"Save Report"}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Form>
                            <Form.Group as={Row} controlId="formPlaintextPassword">
                                <Form.Label column sm="3">
                                    {"Save path"}
                                </Form.Label>
                                <Col sm="7">
                                    <Form.Control readOnly
                                        style={{cursor: "pointer"}}
                                        value={this.state.reportFilePath}
                                        onChange={(value) => { this.setReportFilePath(value); }}
                                        onClick={(e) => this.state.confirmBtnEnabled ? this.onReportFilePathClick() : alert('保存过程中无法修改路径')} />
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} controlId="formPlaintextPassword">
                                <Form.Label column sm="3">
                                    {"符号文件夹"}
                                </Form.Label>
                                <Col sm="7">
                                    <Form.Control readOnly
                                                  style={{cursor: "pointer"}}
                                                  value={this.state.SODir}
                                                  onClick={(e) => this.state.confirmBtnEnabled ? this.onSODirClick() : alert('保存过程中无法修改路径')} />
                                </Col>
                            </Form.Group>
                        </Form>
                    </Modal.Body>

                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => this.props.onClose()} >{"Cancel"}</Button>
                        <Button variant="primary" disabled={!this.state.confirmBtnEnabled} onClick={() => this.onConfirmBtnClick()}>
                            {!this.state.confirmBtnEnabled && (
                                <Spinner
                                    as="span"
                                    animation="border"
                                    size="sm"
                                    role="status"
                                    aria-hidden="true"
                                    style={{ marginRight: "4px" }}
                                />
                            )}
                            {this.state.confirmBtnEnabled ? "Confirm" : "Saving..."}
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    }

}



SaveModal.propTypes = {
};