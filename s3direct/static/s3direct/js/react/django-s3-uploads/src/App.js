import React, { Component } from 'react';
import './App.css';

class S3Upload extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="s3direct" data-policy-url="{ this.props.url }">
                <a className="file-link" target="_blank" href="{{ file_url }}">{ this.props.fileName }</a>
                <a className="file-remove" href="#remove">{ this.props.removeTxt }</a>
                <input className="file-url" type="hidden" value="{{ this.props.fileURL }}" id="{{ this.props.elementID }}" name="{{ this.props.formName }}" />
                <input className="file-dest" type="hidden" value="{{ this.props.dest }}" />
                <input className="file-input" type="file" />
                <div className="progress progress-striped active">
                    <div className="bar"></div>
                </div>
            </div>
        );
    }
}

S3Upload.propTypes = {

};

S3Upload.defaultProps = {

};

export default S3Upload;