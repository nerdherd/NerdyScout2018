// Platform: browser
// ???
// browserify
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var PLATFORM_VERSION_BUILD_LABEL = '5.0.3';
var define = {moduleMap: []};
require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require('cordova/init');

},{"cordova/init":"cordova/init"}],"cordova-plugin-file-transfer.BrowserFileTransfer":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/*global module, require*/

var argscheck = require('cordova/argscheck'),
    FileTransferError = require('cordova-plugin-file-transfer.FileTransferError');

function getParentPath(filePath) {
    var pos = filePath.lastIndexOf('/');
    return filePath.substring(0, pos + 1);
}

function getFileName(filePath) {
    var pos = filePath.lastIndexOf('/');
    return filePath.substring(pos + 1);
}

function getUrlCredentials(urlString) {
    var credentialsPattern = /^https?\:\/\/(?:(?:(([^:@\/]*)(?::([^@\/]*))?)?@)?([^:\/?#]*)(?::(\d*))?).*$/,
        credentials = credentialsPattern.exec(urlString);

    return credentials && credentials[1];
}

function getBasicAuthHeader(urlString) {
    var header =  null;


    // This is changed due to MS Windows doesn't support credentials in http uris
    // so we detect them by regexp and strip off from result url
    // Proof: http://social.msdn.microsoft.com/Forums/windowsapps/en-US/a327cf3c-f033-4a54-8b7f-03c56ba3203f/windows-foundation-uri-security-problem

    if (window.btoa) {
        var credentials = getUrlCredentials(urlString);
        if (credentials) {
            var authHeader = "Authorization";
            var authHeaderValue = "Basic " + window.btoa(credentials);

            header = {
                name : authHeader,
                value : authHeaderValue
            };
        }
    }

    return header;
}

function checkURL(url) {
    return url.indexOf(' ') === -1 ?  true : false;
}

var idCounter = 0;

var transfers = {};

/**
 * FileTransfer uploads a file to a remote server.
 * @constructor
 */
var FileTransfer = function() {
    this._id = ++idCounter;
    this.onprogress = null; // optional callback
};

/**
 * Given an absolute file path, uploads a file on the device to a remote server
 * using a multipart HTTP request.
 * @param filePath {String}           Full path of the file on the device
 * @param server {String}             URL of the server to receive the file
 * @param successCallback (Function}  Callback to be invoked when upload has completed
 * @param errorCallback {Function}    Callback to be invoked upon error
 * @param options {FileUploadOptions} Optional parameters such as file name and mimetype
 * @param trustAllHosts {Boolean} Optional trust all hosts (e.g. for self-signed certs), defaults to false
 */
FileTransfer.prototype.upload = function(filePath, server, successCallback, errorCallback, options) {
    // check for arguments
    argscheck.checkArgs('ssFFO*', 'FileTransfer.upload', arguments);

    // Check if target URL doesn't contain spaces. If contains, it should be escaped first
    // (see https://github.com/apache/cordova-plugin-file-transfer/blob/master/doc/index.md#upload)
    if (!checkURL(server)) {
        if (errorCallback) {
            errorCallback(new FileTransferError(FileTransferError.INVALID_URL_ERR, filePath, server));
        }
        return;
    }

    options = options || {};

    var fileKey = options.fileKey || "file";
    var fileName = options.fileName || "image.jpg";
    var mimeType = options.mimeType || "image/jpeg";
    var params = options.params || {};
    var withCredentials = options.withCredentials || false;
    // var chunkedMode = !!options.chunkedMode; // Not supported
    var headers = options.headers || {};
    var httpMethod = options.httpMethod && options.httpMethod.toUpperCase() === "PUT" ? "PUT" : "POST";

    var basicAuthHeader = getBasicAuthHeader(server);
    if (basicAuthHeader) {
        server = server.replace(getUrlCredentials(server) + '@', '');
        headers[basicAuthHeader.name] = basicAuthHeader.value;
    }

    var that = this;
    var xhr = transfers[this._id] = new XMLHttpRequest();
    xhr.withCredentials = withCredentials;

    var fail = errorCallback && function(code, status, response) {
        if (transfers[this._id]) {
            delete transfers[this._id];
        }
        var error = new FileTransferError(code, filePath, server, status, response);
        if (errorCallback) {
            errorCallback(error);
        }
    };

    window.resolveLocalFileSystemURL(filePath, function(entry) {
        entry.file(function(file) {
            var reader = new FileReader();
            reader.onloadend = function() {
                var blob = new Blob([this.result], {type: mimeType});

                // Prepare form data to send to server
                var fd = new FormData();
                fd.append(fileKey, blob, fileName);
                for (var prop in params) {
                    if (params.hasOwnProperty(prop)) {
                        fd.append(prop, params[prop]);
                    }
                }

                xhr.open(httpMethod, server);

                // Fill XHR headers
                for (var header in headers) {
                    if (headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header, headers[header]);
                    }
                }

                xhr.onload = function() {
                    // 2xx codes are valid
                    if (this.status >= 200 &&
                       this.status < 300) {
                        var result = new FileUploadResult(); // jshint ignore:line
                        result.bytesSent = blob.size;
                        result.responseCode = this.status;
                        result.response = this.response;
                        delete transfers[that._id];
                        successCallback(result);
                    } else if (this.status === 404) {
                        fail(FileTransferError.INVALID_URL_ERR, this.status, this.response);
                    } else {
                        fail(FileTransferError.CONNECTION_ERR, this.status, this.response);
                    }
                };

                xhr.ontimeout = function() {
                    fail(FileTransferError.CONNECTION_ERR, this.status, this.response);
                };

                xhr.onerror = function() {
                    fail(FileTransferError.CONNECTION_ERR, this.status, this.response);
                };

                xhr.onabort = function () {
                    fail(FileTransferError.ABORT_ERR, this.status, this.response);
                };

                xhr.upload.onprogress = function (e) {
                    if (that.onprogress) {
                        that.onprogress(e);
                    }
                };

                xhr.send(fd);
                // Special case when transfer already aborted, but XHR isn't sent.
                // In this case XHR won't fire an abort event, so we need to check if transfers record
                // isn't deleted by filetransfer.abort and if so, call XHR's abort method again
                if (!transfers[that._id]) {
                    xhr.abort();
                }
            };
            reader.readAsArrayBuffer(file);
        }, function() {
            fail(FileTransferError.FILE_NOT_FOUND_ERR);
        });
    }, function() {
        fail(FileTransferError.FILE_NOT_FOUND_ERR);
    });
};

/**
 * Downloads a file form a given URL and saves it to the specified directory.
 * @param source {String}          URL of the server to receive the file
 * @param target {String}         Full path of the file on the device
 * @param successCallback (Function}  Callback to be invoked when upload has completed
 * @param errorCallback {Function}    Callback to be invoked upon error
 * @param trustAllHosts {Boolean} Optional trust all hosts (e.g. for self-signed certs), defaults to false
 * @param options {FileDownloadOptions} Optional parameters such as headers
 */
FileTransfer.prototype.download = function(source, target, successCallback, errorCallback, trustAllHosts, options) {
    argscheck.checkArgs('ssFF*', 'FileTransfer.download', arguments);

    // Check if target URL doesn't contain spaces. If contains, it should be escaped first
    // (see https://github.com/apache/cordova-plugin-file-transfer/blob/master/doc/index.md#download)
    if (!checkURL(source)) {
        if (errorCallback) {
            errorCallback(new FileTransferError(FileTransferError.INVALID_URL_ERR, source, target));
        }
        return;
    }

    options = options || {};
    
    var headers = options.headers || {};
    var withCredentials = options.withCredentials || false;

    var basicAuthHeader = getBasicAuthHeader(source);
    if (basicAuthHeader) {
        source = source.replace(getUrlCredentials(source) + '@', '');
        headers[basicAuthHeader.name] = basicAuthHeader.value;
    }

    var that = this;
    var xhr = transfers[this._id] = new XMLHttpRequest();
    xhr.withCredentials = withCredentials;
    var fail = errorCallback && function(code, status, response) {
        if (transfers[that._id]) {
            delete transfers[that._id];
        }
        // In XHR GET reqests we're setting response type to Blob
        // but in case of error we need to raise event with plain text response
        if (response instanceof Blob) {
            var reader = new FileReader();
            reader.readAsText(response);
            reader.onloadend = function(e) {
                var error = new FileTransferError(code, source, target, status, e.target.result);
                errorCallback(error);
            };
        } else {
            var error = new FileTransferError(code, source, target, status, response);
            errorCallback(error);
        }
    };

    xhr.onload = function (e) {

        var fileNotFound = function () {
            fail(FileTransferError.FILE_NOT_FOUND_ERR);
        };

        var req = e.target;
        // req.status === 0 is special case for local files with file:// URI scheme
        if ((req.status === 200 || req.status === 0) && req.response) {
            window.resolveLocalFileSystemURL(getParentPath(target), function (dir) {
                dir.getFile(getFileName(target), {create: true}, function writeFile(entry) {
                    entry.createWriter(function (fileWriter) {
                        fileWriter.onwriteend = function (evt) {
                            if (!evt.target.error) {
                                entry.filesystemName = entry.filesystem.name;
                                delete transfers[that._id];
                                if (successCallback) {
                                    successCallback(entry);
                                }
                            } else {
                                fail(FileTransferError.FILE_NOT_FOUND_ERR);
                            }
                        };
                        fileWriter.onerror = function () {
                            fail(FileTransferError.FILE_NOT_FOUND_ERR);
                        };
                        fileWriter.write(req.response);
                    }, fileNotFound);
                }, fileNotFound);
            }, fileNotFound);
        } else if (req.status === 404) {
            fail(FileTransferError.INVALID_URL_ERR, req.status, req.response);
        } else {
            fail(FileTransferError.CONNECTION_ERR, req.status, req.response);
        }
    };

    xhr.onprogress = function (e) {
        if (that.onprogress) {
            that.onprogress(e);
        }
    };

    xhr.onerror = function () {
        fail(FileTransferError.CONNECTION_ERR, this.status, this.response);
    };

    xhr.onabort = function () {
        fail(FileTransferError.ABORT_ERR, this.status, this.response);
    };

    xhr.open("GET", source, true);

    for (var header in headers) {
        if (headers.hasOwnProperty(header)) {
            xhr.setRequestHeader(header, headers[header]);
        }
    }

    xhr.responseType = "blob";

    xhr.send();
};

/**
 * Aborts the ongoing file transfer on this object. The original error
 * callback for the file transfer will be called if necessary.
 */
FileTransfer.prototype.abort = function() {
    if (this instanceof FileTransfer) {
        if (transfers[this._id]) {
            transfers[this._id].abort();
            delete transfers[this._id];
        }
    }
};

module.exports = FileTransfer;

},{"cordova-plugin-file-transfer.FileTransferError":"cordova-plugin-file-transfer.FileTransferError","cordova/argscheck":"cordova/argscheck"}],"cordova-plugin-file-transfer.FileTransferError":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/**
 * FileTransferError
 * @constructor
 */
var FileTransferError = function(code, source, target, status, body, exception) {
    this.code = code || null;
    this.source = source || null;
    this.target = target || null;
    this.http_status = status || null;
    this.body = body || null;
    this.exception = exception || null;
};

FileTransferError.FILE_NOT_FOUND_ERR = 1;
FileTransferError.INVALID_URL_ERR = 2;
FileTransferError.CONNECTION_ERR = 3;
FileTransferError.ABORT_ERR = 4;
FileTransferError.NOT_MODIFIED_ERR = 5;

module.exports = FileTransferError;

},{}],"cordova-plugin-file-transfer.FileTransfer":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/* global cordova, FileSystem */

var argscheck = require('cordova/argscheck'),
    exec = require('cordova/exec'),
    FileTransferError = require('cordova-plugin-file-transfer.FileTransferError'),
    ProgressEvent = require('cordova-plugin-file.ProgressEvent');

function newProgressEvent(result) {
    var pe = new ProgressEvent();
    pe.lengthComputable = result.lengthComputable;
    pe.loaded = result.loaded;
    pe.total = result.total;
    return pe;
}

function getUrlCredentials(urlString) {
    var credentialsPattern = /^https?\:\/\/(?:(?:(([^:@\/]*)(?::([^@\/]*))?)?@)?([^:\/?#]*)(?::(\d*))?).*$/,
        credentials = credentialsPattern.exec(urlString);

    return credentials && credentials[1];
}

function getBasicAuthHeader(urlString) {
    var header =  null;


    // This is changed due to MS Windows doesn't support credentials in http uris
    // so we detect them by regexp and strip off from result url
    // Proof: http://social.msdn.microsoft.com/Forums/windowsapps/en-US/a327cf3c-f033-4a54-8b7f-03c56ba3203f/windows-foundation-uri-security-problem

    if (window.btoa) {
        var credentials = getUrlCredentials(urlString);
        if (credentials) {
            var authHeader = "Authorization";
            var authHeaderValue = "Basic " + window.btoa(credentials);

            header = {
                name : authHeader,
                value : authHeaderValue
            };
        }
    }

    return header;
}

function convertHeadersToArray(headers) {
    var result = [];
    for (var header in headers) {
        if (headers.hasOwnProperty(header)) {
            var headerValue = headers[header];
            result.push({
                name: header,
                value: headerValue.toString()
            });
        }
    }
    return result;
}

var idCounter = 0;

/**
 * FileTransfer uploads a file to a remote server.
 * @constructor
 */
var FileTransfer = function() {
    this._id = ++idCounter;
    this.onprogress = null; // optional callback
};

/**
* Given an absolute file path, uploads a file on the device to a remote server
* using a multipart HTTP request.
* @param filePath {String}           Full path of the file on the device
* @param server {String}             URL of the server to receive the file
* @param successCallback (Function}  Callback to be invoked when upload has completed
* @param errorCallback {Function}    Callback to be invoked upon error
* @param options {FileUploadOptions} Optional parameters such as file name and mimetype
* @param trustAllHosts {Boolean} Optional trust all hosts (e.g. for self-signed certs), defaults to false
*/
FileTransfer.prototype.upload = function(filePath, server, successCallback, errorCallback, options, trustAllHosts) {
    argscheck.checkArgs('ssFFO*', 'FileTransfer.upload', arguments);
    // check for options
    var fileKey = null;
    var fileName = null;
    var mimeType = null;
    var params = null;
    var chunkedMode = true;
    var headers = null;
    var httpMethod = null;
    var basicAuthHeader = getBasicAuthHeader(server);
    if (basicAuthHeader) {
        server = server.replace(getUrlCredentials(server) + '@', '');

        options = options || {};
        options.headers = options.headers || {};
        options.headers[basicAuthHeader.name] = basicAuthHeader.value;
    }

    if (options) {
        fileKey = options.fileKey;
        fileName = options.fileName;
        mimeType = options.mimeType;
        headers = options.headers;
        httpMethod = options.httpMethod || "POST";
        if (httpMethod.toUpperCase() == "PUT"){
            httpMethod = "PUT";
        } else {
            httpMethod = "POST";
        }
        if (options.chunkedMode !== null || typeof options.chunkedMode != "undefined") {
            chunkedMode = options.chunkedMode;
        }
        if (options.params) {
            params = options.params;
        }
        else {
            params = {};
        }
    }

    if (cordova.platformId === "windowsphone") {
        headers = headers && convertHeadersToArray(headers);
        params = params && convertHeadersToArray(params);
    }

    var fail = errorCallback && function(e) {
        var error = new FileTransferError(e.code, e.source, e.target, e.http_status, e.body, e.exception);
        errorCallback(error);
    };

    var self = this;
    var win = function(result) {
        if (typeof result.lengthComputable != "undefined") {
            if (self.onprogress) {
                self.onprogress(newProgressEvent(result));
            }
        } else {
            if (successCallback) {
                successCallback(result);
            }
        }
    };
    exec(win, fail, 'FileTransfer', 'upload', [filePath, server, fileKey, fileName, mimeType, params, trustAllHosts, chunkedMode, headers, this._id, httpMethod]);
};

/**
 * Downloads a file form a given URL and saves it to the specified directory.
 * @param source {String}          URL of the server to receive the file
 * @param target {String}         Full path of the file on the device
 * @param successCallback (Function}  Callback to be invoked when upload has completed
 * @param errorCallback {Function}    Callback to be invoked upon error
 * @param trustAllHosts {Boolean} Optional trust all hosts (e.g. for self-signed certs), defaults to false
 * @param options {FileDownloadOptions} Optional parameters such as headers
 */
FileTransfer.prototype.download = function(source, target, successCallback, errorCallback, trustAllHosts, options) {
    argscheck.checkArgs('ssFF*', 'FileTransfer.download', arguments);
    var self = this;

    var basicAuthHeader = getBasicAuthHeader(source);
    if (basicAuthHeader) {
        source = source.replace(getUrlCredentials(source) + '@', '');

        options = options || {};
        options.headers = options.headers || {};
        options.headers[basicAuthHeader.name] = basicAuthHeader.value;
    }

    var headers = null;
    if (options) {
        headers = options.headers || null;
    }

    if (cordova.platformId === "windowsphone" && headers) {
        headers = convertHeadersToArray(headers);
    }

    var win = function(result) {
        if (typeof result.lengthComputable != "undefined") {
            if (self.onprogress) {
                return self.onprogress(newProgressEvent(result));
            }
        } else if (successCallback) {
            var entry = null;
            if (result.isDirectory) {
                entry = new (require('cordova-plugin-file.DirectoryEntry'))();
            }
            else if (result.isFile) {
                entry = new (require('cordova-plugin-file.FileEntry'))();
            }
            entry.isDirectory = result.isDirectory;
            entry.isFile = result.isFile;
            entry.name = result.name;
            entry.fullPath = result.fullPath;
            entry.filesystem = new FileSystem(result.filesystemName || (result.filesystem == window.PERSISTENT ? 'persistent' : 'temporary'));
            entry.nativeURL = result.nativeURL;
            successCallback(entry);
        }
    };

    var fail = errorCallback && function(e) {
        var error = new FileTransferError(e.code, e.source, e.target, e.http_status, e.body, e.exception);
        errorCallback(error);
    };

    exec(win, fail, 'FileTransfer', 'download', [source, target, trustAllHosts, this._id, headers]);
};

/**
 * Aborts the ongoing file transfer on this object. The original error
 * callback for the file transfer will be called if necessary.
 */
FileTransfer.prototype.abort = function() {
    exec(null, null, 'FileTransfer', 'abort', [this._id]);
};

module.exports = FileTransfer;

},{"cordova-plugin-file-transfer.FileTransferError":"cordova-plugin-file-transfer.FileTransferError","cordova-plugin-file.DirectoryEntry":"cordova-plugin-file.DirectoryEntry","cordova-plugin-file.FileEntry":"cordova-plugin-file.FileEntry","cordova-plugin-file.ProgressEvent":"cordova-plugin-file.ProgressEvent","cordova/argscheck":"cordova/argscheck","cordova/exec":"cordova/exec"}],"cordova-plugin-file.DirectoryEntry":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var argscheck = require('cordova/argscheck');
var utils = require('cordova/utils');
var exec = require('cordova/exec');
var Entry = require('cordova-plugin-file.Entry');
var FileError = require('cordova-plugin-file.FileError');
var DirectoryReader = require('cordova-plugin-file.DirectoryReader');

/**
 * An interface representing a directory on the file system.
 *
 * {boolean} isFile always false (readonly)
 * {boolean} isDirectory always true (readonly)
 * {DOMString} name of the directory, excluding the path leading to it (readonly)
 * {DOMString} fullPath the absolute full path to the directory (readonly)
 * {FileSystem} filesystem on which the directory resides (readonly)
 */
var DirectoryEntry = function (name, fullPath, fileSystem, nativeURL) {

    // add trailing slash if it is missing
    if ((fullPath) && !/\/$/.test(fullPath)) {
        fullPath += '/';
    }
    // add trailing slash if it is missing
    if (nativeURL && !/\/$/.test(nativeURL)) {
        nativeURL += '/';
    }
    DirectoryEntry.__super__.constructor.call(this, false, true, name, fullPath, fileSystem, nativeURL);
};

utils.extend(DirectoryEntry, Entry);

/**
 * Creates a new DirectoryReader to read entries from this directory
 */
DirectoryEntry.prototype.createReader = function () {
    return new DirectoryReader(this.toInternalURL());
};

/**
 * Creates or looks up a directory
 *
 * @param {DOMString} path either a relative or absolute path from this directory in which to look up or create a directory
 * @param {Flags} options to create or exclusively create the directory
 * @param {Function} successCallback is called with the new entry
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryEntry.prototype.getDirectory = function (path, options, successCallback, errorCallback) {
    argscheck.checkArgs('sOFF', 'DirectoryEntry.getDirectory', arguments);
    var fs = this.filesystem;
    var win = successCallback && function (result) {
        var entry = new DirectoryEntry(result.name, result.fullPath, fs, result.nativeURL);
        successCallback(entry);
    };
    var fail = errorCallback && function (code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, 'File', 'getDirectory', [this.toInternalURL(), path, options]);
};

/**
 * Deletes a directory and all of it's contents
 *
 * @param {Function} successCallback is called with no parameters
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryEntry.prototype.removeRecursively = function (successCallback, errorCallback) {
    argscheck.checkArgs('FF', 'DirectoryEntry.removeRecursively', arguments);
    var fail = errorCallback && function (code) {
        errorCallback(new FileError(code));
    };
    exec(successCallback, fail, 'File', 'removeRecursively', [this.toInternalURL()]);
};

/**
 * Creates or looks up a file
 *
 * @param {DOMString} path either a relative or absolute path from this directory in which to look up or create a file
 * @param {Flags} options to create or exclusively create the file
 * @param {Function} successCallback is called with the new entry
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryEntry.prototype.getFile = function (path, options, successCallback, errorCallback) {
    argscheck.checkArgs('sOFF', 'DirectoryEntry.getFile', arguments);
    var fs = this.filesystem;
    var win = successCallback && function (result) {
        var FileEntry = require('cordova-plugin-file.FileEntry');
        var entry = new FileEntry(result.name, result.fullPath, fs, result.nativeURL);
        successCallback(entry);
    };
    var fail = errorCallback && function (code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, 'File', 'getFile', [this.toInternalURL(), path, options]);
};

module.exports = DirectoryEntry;

},{"cordova-plugin-file.DirectoryReader":"cordova-plugin-file.DirectoryReader","cordova-plugin-file.Entry":"cordova-plugin-file.Entry","cordova-plugin-file.FileEntry":"cordova-plugin-file.FileEntry","cordova-plugin-file.FileError":"cordova-plugin-file.FileError","cordova/argscheck":"cordova/argscheck","cordova/exec":"cordova/exec","cordova/utils":"cordova/utils"}],"cordova-plugin-file.DirectoryReader":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var exec = require('cordova/exec');
var FileError = require('cordova-plugin-file.FileError');

/**
 * An interface that lists the files and directories in a directory.
 */
function DirectoryReader (localURL) {
    this.localURL = localURL || null;
    this.hasReadEntries = false;
}

/**
 * Returns a list of entries from a directory.
 *
 * @param {Function} successCallback is called with a list of entries
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryReader.prototype.readEntries = function (successCallback, errorCallback) {
    // If we've already read and passed on this directory's entries, return an empty list.
    if (this.hasReadEntries) {
        successCallback([]);
        return;
    }
    var reader = this;
    var win = typeof successCallback !== 'function' ? null : function (result) {
        var retVal = [];
        for (var i = 0; i < result.length; i++) {
            var entry = null;
            if (result[i].isDirectory) {
                entry = new (require('cordova-plugin-file.DirectoryEntry'))();
            } else if (result[i].isFile) {
                entry = new (require('cordova-plugin-file.FileEntry'))();
            }
            entry.isDirectory = result[i].isDirectory;
            entry.isFile = result[i].isFile;
            entry.name = result[i].name;
            entry.fullPath = result[i].fullPath;
            entry.filesystem = new (require('cordova-plugin-file.FileSystem'))(result[i].filesystemName);
            entry.nativeURL = result[i].nativeURL;
            retVal.push(entry);
        }
        reader.hasReadEntries = true;
        successCallback(retVal);
    };
    var fail = typeof errorCallback !== 'function' ? null : function (code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, 'File', 'readEntries', [this.localURL]);
};

module.exports = DirectoryReader;

},{"cordova-plugin-file.DirectoryEntry":"cordova-plugin-file.DirectoryEntry","cordova-plugin-file.FileEntry":"cordova-plugin-file.FileEntry","cordova-plugin-file.FileError":"cordova-plugin-file.FileError","cordova-plugin-file.FileSystem":"cordova-plugin-file.FileSystem","cordova/exec":"cordova/exec"}],"cordova-plugin-file.Entry":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var argscheck = require('cordova/argscheck');
var exec = require('cordova/exec');
var FileError = require('cordova-plugin-file.FileError');
var Metadata = require('cordova-plugin-file.Metadata');

/**
 * Represents a file or directory on the local file system.
 *
 * @param isFile
 *            {boolean} true if Entry is a file (readonly)
 * @param isDirectory
 *            {boolean} true if Entry is a directory (readonly)
 * @param name
 *            {DOMString} name of the file or directory, excluding the path
 *            leading to it (readonly)
 * @param fullPath
 *            {DOMString} the absolute full path to the file or directory
 *            (readonly)
 * @param fileSystem
 *            {FileSystem} the filesystem on which this entry resides
 *            (readonly)
 * @param nativeURL
 *            {DOMString} an alternate URL which can be used by native
 *            webview controls, for example media players.
 *            (optional, readonly)
 */
function Entry (isFile, isDirectory, name, fullPath, fileSystem, nativeURL) {
    this.isFile = !!isFile;
    this.isDirectory = !!isDirectory;
    this.name = name || '';
    this.fullPath = fullPath || '';
    this.filesystem = fileSystem || null;
    this.nativeURL = nativeURL || null;
}

/**
 * Look up the metadata of the entry.
 *
 * @param successCallback
 *            {Function} is called with a Metadata object
 * @param errorCallback
 *            {Function} is called with a FileError
 */
Entry.prototype.getMetadata = function (successCallback, errorCallback) {
    argscheck.checkArgs('FF', 'Entry.getMetadata', arguments);
    var success = successCallback && function (entryMetadata) {
        var metadata = new Metadata({
            size: entryMetadata.size,
            modificationTime: entryMetadata.lastModifiedDate
        });
        successCallback(metadata);
    };
    var fail = errorCallback && function (code) {
        errorCallback(new FileError(code));
    };
    exec(success, fail, 'File', 'getFileMetadata', [this.toInternalURL()]);
};

/**
 * Set the metadata of the entry.
 *
 * @param successCallback
 *            {Function} is called with a Metadata object
 * @param errorCallback
 *            {Function} is called with a FileError
 * @param metadataObject
 *            {Object} keys and values to set
 */
Entry.prototype.setMetadata = function (successCallback, errorCallback, metadataObject) {
    argscheck.checkArgs('FFO', 'Entry.setMetadata', arguments);
    exec(successCallback, errorCallback, 'File', 'setMetadata', [this.toInternalURL(), metadataObject]);
};

/**
 * Move a file or directory to a new location.
 *
 * @param parent
 *            {DirectoryEntry} the directory to which to move this entry
 * @param newName
 *            {DOMString} new name of the entry, defaults to the current name
 * @param successCallback
 *            {Function} called with the new DirectoryEntry object
 * @param errorCallback
 *            {Function} called with a FileError
 */
Entry.prototype.moveTo = function (parent, newName, successCallback, errorCallback) {
    argscheck.checkArgs('oSFF', 'Entry.moveTo', arguments);
    var fail = errorCallback && function (code) {
        errorCallback(new FileError(code));
    };
    var srcURL = this.toInternalURL();
    // entry name
    var name = newName || this.name;
    var success = function (entry) {
        if (entry) {
            if (successCallback) {
                // create appropriate Entry object
                var newFSName = entry.filesystemName || (entry.filesystem && entry.filesystem.name);
                var fs = newFSName ? new FileSystem(newFSName, { name: '', fullPath: '/' }) : new FileSystem(parent.filesystem.name, { name: '', fullPath: '/' }); // eslint-disable-line no-undef
                var result = (entry.isDirectory) ? new (require('cordova-plugin-file.DirectoryEntry'))(entry.name, entry.fullPath, fs, entry.nativeURL) : new (require('cordova-plugin-file.FileEntry'))(entry.name, entry.fullPath, fs, entry.nativeURL);
                successCallback(result);
            }
        } else {
            // no Entry object returned
            if (fail) {
                fail(FileError.NOT_FOUND_ERR);
            }
        }
    };

    // copy
    exec(success, fail, 'File', 'moveTo', [srcURL, parent.toInternalURL(), name]);
};

/**
 * Copy a directory to a different location.
 *
 * @param parent
 *            {DirectoryEntry} the directory to which to copy the entry
 * @param newName
 *            {DOMString} new name of the entry, defaults to the current name
 * @param successCallback
 *            {Function} called with the new Entry object
 * @param errorCallback
 *            {Function} called with a FileError
 */
Entry.prototype.copyTo = function (parent, newName, successCallback, errorCallback) {
    argscheck.checkArgs('oSFF', 'Entry.copyTo', arguments);
    var fail = errorCallback && function (code) {
        errorCallback(new FileError(code));
    };
    var srcURL = this.toInternalURL();
        // entry name
    var name = newName || this.name;
    // success callback
    var success = function (entry) {
        if (entry) {
            if (successCallback) {
                // create appropriate Entry object
                var newFSName = entry.filesystemName || (entry.filesystem && entry.filesystem.name);
                var fs = newFSName ? new FileSystem(newFSName, { name: '', fullPath: '/' }) : new FileSystem(parent.filesystem.name, { name: '', fullPath: '/' }); // eslint-disable-line no-undef
                var result = (entry.isDirectory) ? new (require('cordova-plugin-file.DirectoryEntry'))(entry.name, entry.fullPath, fs, entry.nativeURL) : new (require('cordova-plugin-file.FileEntry'))(entry.name, entry.fullPath, fs, entry.nativeURL);
                successCallback(result);
            }
        } else {
            // no Entry object returned
            if (fail) {
                fail(FileError.NOT_FOUND_ERR);
            }
        }
    };

    // copy
    exec(success, fail, 'File', 'copyTo', [srcURL, parent.toInternalURL(), name]);
};

/**
 * Return a URL that can be passed across the bridge to identify this entry.
 */
Entry.prototype.toInternalURL = function () {
    if (this.filesystem && this.filesystem.__format__) {
        return this.filesystem.__format__(this.fullPath, this.nativeURL);
    }
};

/**
 * Return a URL that can be used to identify this entry.
 * Use a URL that can be used to as the src attribute of a <video> or
 * <audio> tag. If that is not possible, construct a cdvfile:// URL.
 */
Entry.prototype.toURL = function () {
    if (this.nativeURL) {
        return this.nativeURL;
    }
    // fullPath attribute may contain the full URL in the case that
    // toInternalURL fails.
    return this.toInternalURL() || 'file://localhost' + this.fullPath;
};

/**
 * Backwards-compatibility: In v1.0.0 - 1.0.2, .toURL would only return a
 * cdvfile:// URL, and this method was necessary to obtain URLs usable by the
 * webview.
 * See CB-6051, CB-6106, CB-6117, CB-6152, CB-6199, CB-6201, CB-6243, CB-6249,
 * and CB-6300.
 */
Entry.prototype.toNativeURL = function () {
    console.log("DEPRECATED: Update your code to use 'toURL'");
    return this.toURL();
};

/**
 * Returns a URI that can be used to identify this entry.
 *
 * @param {DOMString} mimeType for a FileEntry, the mime type to be used to interpret the file, when loaded through this URI.
 * @return uri
 */
Entry.prototype.toURI = function (mimeType) {
    console.log("DEPRECATED: Update your code to use 'toURL'");
    return this.toURL();
};

/**
 * Remove a file or directory. It is an error to attempt to delete a
 * directory that is not empty. It is an error to attempt to delete a
 * root directory of a file system.
 *
 * @param successCallback {Function} called with no parameters
 * @param errorCallback {Function} called with a FileError
 */
Entry.prototype.remove = function (successCallback, errorCallback) {
    argscheck.checkArgs('FF', 'Entry.remove', arguments);
    var fail = errorCallback && function (code) {
        errorCallback(new FileError(code));
    };
    exec(successCallback, fail, 'File', 'remove', [this.toInternalURL()]);
};

/**
 * Look up the parent DirectoryEntry of this entry.
 *
 * @param successCallback {Function} called with the parent DirectoryEntry object
 * @param errorCallback {Function} called with a FileError
 */
Entry.prototype.getParent = function (successCallback, errorCallback) {
    argscheck.checkArgs('FF', 'Entry.getParent', arguments);
    var fs = this.filesystem;
    var win = successCallback && function (result) {
        var DirectoryEntry = require('cordova-plugin-file.DirectoryEntry');
        var entry = new DirectoryEntry(result.name, result.fullPath, fs, result.nativeURL);
        successCallback(entry);
    };
    var fail = errorCallback && function (code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, 'File', 'getParent', [this.toInternalURL()]);
};

module.exports = Entry;

},{"cordova-plugin-file.DirectoryEntry":"cordova-plugin-file.DirectoryEntry","cordova-plugin-file.FileEntry":"cordova-plugin-file.FileEntry","cordova-plugin-file.FileError":"cordova-plugin-file.FileError","cordova-plugin-file.Metadata":"cordova-plugin-file.Metadata","cordova/argscheck":"cordova/argscheck","cordova/exec":"cordova/exec"}],"cordova-plugin-file.FileEntry":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var utils = require('cordova/utils');
var exec = require('cordova/exec');
var Entry = require('cordova-plugin-file.Entry');
var FileWriter = require('cordova-plugin-file.FileWriter');
var File = require('cordova-plugin-file.File');
var FileError = require('cordova-plugin-file.FileError');

/**
 * An interface representing a file on the file system.
 *
 * {boolean} isFile always true (readonly)
 * {boolean} isDirectory always false (readonly)
 * {DOMString} name of the file, excluding the path leading to it (readonly)
 * {DOMString} fullPath the absolute full path to the file (readonly)
 * {FileSystem} filesystem on which the file resides (readonly)
 */
var FileEntry = function (name, fullPath, fileSystem, nativeURL) {
    // remove trailing slash if it is present
    if (fullPath && /\/$/.test(fullPath)) {
        fullPath = fullPath.substring(0, fullPath.length - 1);
    }
    if (nativeURL && /\/$/.test(nativeURL)) {
        nativeURL = nativeURL.substring(0, nativeURL.length - 1);
    }

    FileEntry.__super__.constructor.apply(this, [true, false, name, fullPath, fileSystem, nativeURL]);
};

utils.extend(FileEntry, Entry);

/**
 * Creates a new FileWriter associated with the file that this FileEntry represents.
 *
 * @param {Function} successCallback is called with the new FileWriter
 * @param {Function} errorCallback is called with a FileError
 */
FileEntry.prototype.createWriter = function (successCallback, errorCallback) {
    this.file(function (filePointer) {
        var writer = new FileWriter(filePointer);

        if (writer.localURL === null || writer.localURL === '') {
            if (errorCallback) {
                errorCallback(new FileError(FileError.INVALID_STATE_ERR));
            }
        } else {
            if (successCallback) {
                successCallback(writer);
            }
        }
    }, errorCallback);
};

/**
 * Returns a File that represents the current state of the file that this FileEntry represents.
 *
 * @param {Function} successCallback is called with the new File object
 * @param {Function} errorCallback is called with a FileError
 */
FileEntry.prototype.file = function (successCallback, errorCallback) {
    var localURL = this.toInternalURL();
    var win = successCallback && function (f) {
        var file = new File(f.name, localURL, f.type, f.lastModifiedDate, f.size);
        successCallback(file);
    };
    var fail = errorCallback && function (code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, 'File', 'getFileMetadata', [localURL]);
};

module.exports = FileEntry;

},{"cordova-plugin-file.Entry":"cordova-plugin-file.Entry","cordova-plugin-file.File":"cordova-plugin-file.File","cordova-plugin-file.FileError":"cordova-plugin-file.FileError","cordova-plugin-file.FileWriter":"cordova-plugin-file.FileWriter","cordova/exec":"cordova/exec","cordova/utils":"cordova/utils"}],"cordova-plugin-file.FileError":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/**
 * FileError
 */
function FileError (error) {
    this.code = error || null;
}

// File error codes
// Found in DOMException
FileError.NOT_FOUND_ERR = 1;
FileError.SECURITY_ERR = 2;
FileError.ABORT_ERR = 3;

// Added by File API specification
FileError.NOT_READABLE_ERR = 4;
FileError.ENCODING_ERR = 5;
FileError.NO_MODIFICATION_ALLOWED_ERR = 6;
FileError.INVALID_STATE_ERR = 7;
FileError.SYNTAX_ERR = 8;
FileError.INVALID_MODIFICATION_ERR = 9;
FileError.QUOTA_EXCEEDED_ERR = 10;
FileError.TYPE_MISMATCH_ERR = 11;
FileError.PATH_EXISTS_ERR = 12;

module.exports = FileError;

},{}],"cordova-plugin-file.FileReader":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var exec = require('cordova/exec');
var modulemapper = require('cordova/modulemapper');
var utils = require('cordova/utils');
var FileError = require('cordova-plugin-file.FileError');
var ProgressEvent = require('cordova-plugin-file.ProgressEvent');
var origFileReader = modulemapper.getOriginalSymbol(window, 'FileReader');

/**
 * This class reads the mobile device file system.
 *
 * For Android:
 *      The root directory is the root of the file system.
 *      To read from the SD card, the file name is "sdcard/my_file.txt"
 * @constructor
 */
var FileReader = function () {
    this._readyState = 0;
    this._error = null;
    this._result = null;
    this._progress = null;
    this._localURL = '';
    this._realReader = origFileReader ? new origFileReader() : {}; // eslint-disable-line new-cap
};

/**
 * Defines the maximum size to read at a time via the native API. The default value is a compromise between
 * minimizing the overhead of many exec() calls while still reporting progress frequently enough for large files.
 * (Note attempts to allocate more than a few MB of contiguous memory on the native side are likely to cause
 * OOM exceptions, while the JS engine seems to have fewer problems managing large strings or ArrayBuffers.)
 */
FileReader.READ_CHUNK_SIZE = 256 * 1024;

// States
FileReader.EMPTY = 0;
FileReader.LOADING = 1;
FileReader.DONE = 2;

utils.defineGetter(FileReader.prototype, 'readyState', function () {
    return this._localURL ? this._readyState : this._realReader.readyState;
});

utils.defineGetter(FileReader.prototype, 'error', function () {
    return this._localURL ? this._error : this._realReader.error;
});

utils.defineGetter(FileReader.prototype, 'result', function () {
    return this._localURL ? this._result : this._realReader.result;
});

function defineEvent (eventName) {
    utils.defineGetterSetter(FileReader.prototype, eventName, function () {
        return this._realReader[eventName] || null;
    }, function (value) {
        this._realReader[eventName] = value;
    });
}
defineEvent('onloadstart');    // When the read starts.
defineEvent('onprogress');     // While reading (and decoding) file or fileBlob data, and reporting partial file data (progress.loaded/progress.total)
defineEvent('onload');         // When the read has successfully completed.
defineEvent('onerror');        // When the read has failed (see errors).
defineEvent('onloadend');      // When the request has completed (either in success or failure).
defineEvent('onabort');        // When the read has been aborted. For instance, by invoking the abort() method.

function initRead (reader, file) {
    // Already loading something
    if (reader.readyState === FileReader.LOADING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    reader._result = null;
    reader._error = null;
    reader._progress = 0;
    reader._readyState = FileReader.LOADING;

    if (typeof file.localURL === 'string') {
        reader._localURL = file.localURL;
    } else {
        reader._localURL = '';
        return true;
    }

    if (reader.onloadstart) {
        reader.onloadstart(new ProgressEvent('loadstart', {target: reader}));
    }
}

/**
 * Callback used by the following read* functions to handle incremental or final success.
 * Must be bound to the FileReader's this along with all but the last parameter,
 * e.g. readSuccessCallback.bind(this, "readAsText", "UTF-8", offset, totalSize, accumulate)
 * @param readType The name of the read function to call.
 * @param encoding Text encoding, or null if this is not a text type read.
 * @param offset Starting offset of the read.
 * @param totalSize Total number of bytes or chars to read.
 * @param accumulate A function that takes the callback result and accumulates it in this._result.
 * @param r Callback result returned by the last read exec() call, or null to begin reading.
 */
function readSuccessCallback (readType, encoding, offset, totalSize, accumulate, r) {
    if (this._readyState === FileReader.DONE) {
        return;
    }

    var CHUNK_SIZE = FileReader.READ_CHUNK_SIZE;
    if (readType === 'readAsDataURL') {
        // Windows proxy does not support reading file slices as Data URLs
        // so read the whole file at once.
        CHUNK_SIZE = cordova.platformId === 'windows' ? totalSize : // eslint-disable-line no-undef
            // Calculate new chunk size for data URLs to be multiply of 3
            // Otherwise concatenated base64 chunks won't be valid base64 data
            FileReader.READ_CHUNK_SIZE - (FileReader.READ_CHUNK_SIZE % 3) + 3;
    }

    if (typeof r !== 'undefined') {
        accumulate(r);
        this._progress = Math.min(this._progress + CHUNK_SIZE, totalSize);

        if (typeof this.onprogress === 'function') {
            this.onprogress(new ProgressEvent('progress', {loaded: this._progress, total: totalSize}));
        }
    }

    if (typeof r === 'undefined' || this._progress < totalSize) {
        var execArgs = [
            this._localURL,
            offset + this._progress,
            offset + this._progress + Math.min(totalSize - this._progress, CHUNK_SIZE)];
        if (encoding) {
            execArgs.splice(1, 0, encoding);
        }
        exec(
            readSuccessCallback.bind(this, readType, encoding, offset, totalSize, accumulate),
            readFailureCallback.bind(this),
            'File', readType, execArgs);
    } else {
        this._readyState = FileReader.DONE;

        if (typeof this.onload === 'function') {
            this.onload(new ProgressEvent('load', {target: this}));
        }

        if (typeof this.onloadend === 'function') {
            this.onloadend(new ProgressEvent('loadend', {target: this}));
        }
    }
}

/**
 * Callback used by the following read* functions to handle errors.
 * Must be bound to the FileReader's this, e.g. readFailureCallback.bind(this)
 */
function readFailureCallback (e) {
    if (this._readyState === FileReader.DONE) {
        return;
    }

    this._readyState = FileReader.DONE;
    this._result = null;
    this._error = new FileError(e);

    if (typeof this.onerror === 'function') {
        this.onerror(new ProgressEvent('error', {target: this}));
    }

    if (typeof this.onloadend === 'function') {
        this.onloadend(new ProgressEvent('loadend', {target: this}));
    }
}

/**
 * Abort reading file.
 */
FileReader.prototype.abort = function () {
    if (origFileReader && !this._localURL) {
        return this._realReader.abort();
    }
    this._result = null;

    if (this._readyState === FileReader.DONE || this._readyState === FileReader.EMPTY) {
        return;
    }

    this._readyState = FileReader.DONE;

    // If abort callback
    if (typeof this.onabort === 'function') {
        this.onabort(new ProgressEvent('abort', {target: this}));
    }
    // If load end callback
    if (typeof this.onloadend === 'function') {
        this.onloadend(new ProgressEvent('loadend', {target: this}));
    }
};

/**
 * Read text file.
 *
 * @param file          {File} File object containing file properties
 * @param encoding      [Optional] (see http://www.iana.org/assignments/character-sets)
 */
FileReader.prototype.readAsText = function (file, encoding) {
    if (initRead(this, file)) {
        return this._realReader.readAsText(file, encoding);
    }

    // Default encoding is UTF-8
    var enc = encoding || 'UTF-8';

    var totalSize = file.end - file.start;
    readSuccessCallback.bind(this)('readAsText', enc, file.start, totalSize, function (r) {
        if (this._progress === 0) {
            this._result = '';
        }
        this._result += r;
    }.bind(this));
};

/**
 * Read file and return data as a base64 encoded data url.
 * A data url is of the form:
 *      data:[<mediatype>][;base64],<data>
 *
 * @param file          {File} File object containing file properties
 */
FileReader.prototype.readAsDataURL = function (file) {
    if (initRead(this, file)) {
        return this._realReader.readAsDataURL(file);
    }

    var totalSize = file.end - file.start;
    readSuccessCallback.bind(this)('readAsDataURL', null, file.start, totalSize, function (r) {
        var commaIndex = r.indexOf(',');
        if (this._progress === 0) {
            this._result = r;
        } else {
            this._result += r.substring(commaIndex + 1);
        }
    }.bind(this));
};

/**
 * Read file and return data as a binary data.
 *
 * @param file          {File} File object containing file properties
 */
FileReader.prototype.readAsBinaryString = function (file) {
    if (initRead(this, file)) {
        return this._realReader.readAsBinaryString(file);
    }

    var totalSize = file.end - file.start;
    readSuccessCallback.bind(this)('readAsBinaryString', null, file.start, totalSize, function (r) {
        if (this._progress === 0) {
            this._result = '';
        }
        this._result += r;
    }.bind(this));
};

/**
 * Read file and return data as a binary data.
 *
 * @param file          {File} File object containing file properties
 */
FileReader.prototype.readAsArrayBuffer = function (file) {
    if (initRead(this, file)) {
        return this._realReader.readAsArrayBuffer(file);
    }

    var totalSize = file.end - file.start;
    readSuccessCallback.bind(this)('readAsArrayBuffer', null, file.start, totalSize, function (r) {
        var resultArray = (this._progress === 0 ? new Uint8Array(totalSize) : new Uint8Array(this._result));
        resultArray.set(new Uint8Array(r), this._progress);
        this._result = resultArray.buffer;
    }.bind(this));
};

module.exports = FileReader;

},{"cordova-plugin-file.FileError":"cordova-plugin-file.FileError","cordova-plugin-file.ProgressEvent":"cordova-plugin-file.ProgressEvent","cordova/exec":"cordova/exec","cordova/modulemapper":"cordova/modulemapper","cordova/utils":"cordova/utils"}],"cordova-plugin-file.FileSystem":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var DirectoryEntry = require('cordova-plugin-file.DirectoryEntry');

/**
 * An interface representing a file system
 *
 * @constructor
 * {DOMString} name the unique name of the file system (readonly)
 * {DirectoryEntry} root directory of the file system (readonly)
 */
var FileSystem = function (name, root) {
    this.name = name;
    if (root) {
        this.root = new DirectoryEntry(root.name, root.fullPath, this, root.nativeURL);
    } else {
        this.root = new DirectoryEntry(this.name, '/', this);
    }
};

FileSystem.prototype.__format__ = function (fullPath, nativeUrl) {
    return fullPath;
};

FileSystem.prototype.toJSON = function () {
    return '<FileSystem: ' + this.name + '>';
};

// Use instead of encodeURI() when encoding just the path part of a URI rather than an entire URI.
FileSystem.encodeURIPath = function (path) {
    // Because # is a valid filename character, it must be encoded to prevent part of the
    // path from being parsed as a URI fragment.
    return encodeURI(path).replace(/#/g, '%23');
};

module.exports = FileSystem;

},{"cordova-plugin-file.DirectoryEntry":"cordova-plugin-file.DirectoryEntry"}],"cordova-plugin-file.FileUploadOptions":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/**
 * Options to customize the HTTP request used to upload files.
 * @constructor
 * @param fileKey {String}   Name of file request parameter.
 * @param fileName {String}  Filename to be used by the server. Defaults to image.jpg.
 * @param mimeType {String}  Mimetype of the uploaded file. Defaults to image/jpeg.
 * @param params {Object}    Object with key: value params to send to the server.
 * @param headers {Object}   Keys are header names, values are header values. Multiple
 *                           headers of the same name are not supported.
 */
var FileUploadOptions = function (fileKey, fileName, mimeType, params, headers, httpMethod) {
    this.fileKey = fileKey || null;
    this.fileName = fileName || null;
    this.mimeType = mimeType || null;
    this.params = params || null;
    this.headers = headers || null;
    this.httpMethod = httpMethod || null;
};

module.exports = FileUploadOptions;

},{}],"cordova-plugin-file.FileUploadResult":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/**
 * FileUploadResult
 * @constructor
 */
module.exports = function FileUploadResult (size, code, content) {
    this.bytesSent = size;
    this.responseCode = code;
    this.response = content;
};

},{}],"cordova-plugin-file.FileWriter":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var exec = require('cordova/exec');
var FileError = require('cordova-plugin-file.FileError');
var ProgressEvent = require('cordova-plugin-file.ProgressEvent');

/**
 * This class writes to the mobile device file system.
 *
 * For Android:
 *      The root directory is the root of the file system.
 *      To write to the SD card, the file name is "sdcard/my_file.txt"
 *
 * @constructor
 * @param file {File} File object containing file properties
 * @param append if true write to the end of the file, otherwise overwrite the file
 */
var FileWriter = function (file) {
    this.fileName = '';
    this.length = 0;
    if (file) {
        this.localURL = file.localURL || file;
        this.length = file.size || 0;
    }
    // default is to write at the beginning of the file
    this.position = 0;

    this.readyState = 0; // EMPTY

    this.result = null;

    // Error
    this.error = null;

    // Event handlers
    this.onwritestart = null;   // When writing starts
    this.onprogress = null;     // While writing the file, and reporting partial file data
    this.onwrite = null;        // When the write has successfully completed.
    this.onwriteend = null;     // When the request has completed (either in success or failure).
    this.onabort = null;        // When the write has been aborted. For instance, by invoking the abort() method.
    this.onerror = null;        // When the write has failed (see errors).
};

// States
FileWriter.INIT = 0;
FileWriter.WRITING = 1;
FileWriter.DONE = 2;

/**
 * Abort writing file.
 */
FileWriter.prototype.abort = function () {
    // check for invalid state
    if (this.readyState === FileWriter.DONE || this.readyState === FileWriter.INIT) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // set error
    this.error = new FileError(FileError.ABORT_ERR);

    this.readyState = FileWriter.DONE;

    // If abort callback
    if (typeof this.onabort === 'function') {
        this.onabort(new ProgressEvent('abort', {'target': this}));
    }

    // If write end callback
    if (typeof this.onwriteend === 'function') {
        this.onwriteend(new ProgressEvent('writeend', {'target': this}));
    }
};

/**
 * Writes data to the file
 *
 * @param data text or blob to be written
 * @param isPendingBlobReadResult {Boolean} true if the data is the pending blob read operation result
 */
FileWriter.prototype.write = function (data, isPendingBlobReadResult) {

    var that = this;
    var supportsBinary = (typeof window.Blob !== 'undefined' && typeof window.ArrayBuffer !== 'undefined');
    /* eslint-disable no-undef */
    var isProxySupportBlobNatively = (cordova.platformId === 'windows8' || cordova.platformId === 'windows');
    var isBinary;

    // Check to see if the incoming data is a blob
    if (data instanceof File || (!isProxySupportBlobNatively && supportsBinary && data instanceof Blob)) {
        var fileReader = new FileReader();
        /* eslint-enable no-undef */
        fileReader.onload = function () {
            // Call this method again, with the arraybuffer as argument
            FileWriter.prototype.write.call(that, this.result, true /* isPendingBlobReadResult */);
        };
        fileReader.onerror = function () {
            // DONE state
            that.readyState = FileWriter.DONE;

            // Save error
            that.error = this.error;

            // If onerror callback
            if (typeof that.onerror === 'function') {
                that.onerror(new ProgressEvent('error', {'target': that}));
            }

            // If onwriteend callback
            if (typeof that.onwriteend === 'function') {
                that.onwriteend(new ProgressEvent('writeend', {'target': that}));
            }
        };

        // WRITING state
        this.readyState = FileWriter.WRITING;

        if (supportsBinary) {
            fileReader.readAsArrayBuffer(data);
        } else {
            fileReader.readAsText(data);
        }
        return;
    }

    // Mark data type for safer transport over the binary bridge
    isBinary = supportsBinary && (data instanceof ArrayBuffer);
    if (isBinary && cordova.platformId === 'windowsphone') { // eslint-disable-line no-undef
        // create a plain array, using the keys from the Uint8Array view so that we can serialize it
        data = Array.apply(null, new Uint8Array(data));
    }

    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING && !isPendingBlobReadResult) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // WRITING state
    this.readyState = FileWriter.WRITING;

    var me = this;

    // If onwritestart callback
    if (typeof me.onwritestart === 'function') {
        me.onwritestart(new ProgressEvent('writestart', {'target': me}));
    }

    // Write file
    exec(
        // Success callback
        function (r) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // position always increases by bytes written because file would be extended
            me.position += r;
            // The length of the file is now where we are done writing.

            me.length = me.position;

            // DONE state
            me.readyState = FileWriter.DONE;

            // If onwrite callback
            if (typeof me.onwrite === 'function') {
                me.onwrite(new ProgressEvent('write', {'target': me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === 'function') {
                me.onwriteend(new ProgressEvent('writeend', {'target': me}));
            }
        },
        // Error callback
        function (e) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileWriter.DONE;

            // Save error
            me.error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === 'function') {
                me.onerror(new ProgressEvent('error', {'target': me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === 'function') {
                me.onwriteend(new ProgressEvent('writeend', {'target': me}));
            }
        }, 'File', 'write', [this.localURL, data, this.position, isBinary]);
};

/**
 * Moves the file pointer to the location specified.
 *
 * If the offset is a negative number the position of the file
 * pointer is rewound.  If the offset is greater than the file
 * size the position is set to the end of the file.
 *
 * @param offset is the location to move the file pointer to.
 */
FileWriter.prototype.seek = function (offset) {
    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    if (!offset && offset !== 0) {
        return;
    }

    // See back from end of file.
    if (offset < 0) {
        this.position = Math.max(offset + this.length, 0);
    // Offset is bigger than file size so set position
    // to the end of the file.
    } else if (offset > this.length) {
        this.position = this.length;
    // Offset is between 0 and file size so set the position
    // to start writing.
    } else {
        this.position = offset;
    }
};

/**
 * Truncates the file to the size specified.
 *
 * @param size to chop the file at.
 */
FileWriter.prototype.truncate = function (size) {
    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // WRITING state
    this.readyState = FileWriter.WRITING;

    var me = this;

    // If onwritestart callback
    if (typeof me.onwritestart === 'function') {
        me.onwritestart(new ProgressEvent('writestart', {'target': this}));
    }

    // Write file
    exec(
        // Success callback
        function (r) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileWriter.DONE;

            // Update the length of the file
            me.length = r;
            me.position = Math.min(me.position, r);

            // If onwrite callback
            if (typeof me.onwrite === 'function') {
                me.onwrite(new ProgressEvent('write', {'target': me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === 'function') {
                me.onwriteend(new ProgressEvent('writeend', {'target': me}));
            }
        },
        // Error callback
        function (e) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileWriter.DONE;

            // Save error
            me.error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === 'function') {
                me.onerror(new ProgressEvent('error', {'target': me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === 'function') {
                me.onwriteend(new ProgressEvent('writeend', {'target': me}));
            }
        }, 'File', 'truncate', [this.localURL, size]);
};

module.exports = FileWriter;

},{"cordova-plugin-file.FileError":"cordova-plugin-file.FileError","cordova-plugin-file.ProgressEvent":"cordova-plugin-file.ProgressEvent","cordova/exec":"cordova/exec"}],"cordova-plugin-file.File":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/**
 * Constructor.
 * name {DOMString} name of the file, without path information
 * fullPath {DOMString} the full path of the file, including the name
 * type {DOMString} mime type
 * lastModifiedDate {Date} last modified date
 * size {Number} size of the file in bytes
 */

var File = function (name, localURL, type, lastModifiedDate, size) {
    this.name = name || '';
    this.localURL = localURL || null;
    this.type = type || null;
    this.lastModified = lastModifiedDate || null;
    // For backwards compatibility, store the timestamp in lastModifiedDate as well
    this.lastModifiedDate = lastModifiedDate || null;
    this.size = size || 0;

    // These store the absolute start and end for slicing the file.
    this.start = 0;
    this.end = this.size;
};

/**
 * Returns a "slice" of the file. Since Cordova Files don't contain the actual
 * content, this really returns a File with adjusted start and end.
 * Slices of slices are supported.
 * start {Number} The index at which to start the slice (inclusive).
 * end {Number} The index at which to end the slice (exclusive).
 */
File.prototype.slice = function (start, end) {
    var size = this.end - this.start;
    var newStart = 0;
    var newEnd = size;
    if (arguments.length) {
        if (start < 0) {
            newStart = Math.max(size + start, 0);
        } else {
            newStart = Math.min(size, start);
        }
    }

    if (arguments.length >= 2) {
        if (end < 0) {
            newEnd = Math.max(size + end, 0);
        } else {
            newEnd = Math.min(end, size);
        }
    }

    var newFile = new File(this.name, this.localURL, this.type, this.lastModified, this.size);
    newFile.start = this.start + newStart;
    newFile.end = this.start + newEnd;
    return newFile;
};

module.exports = File;

},{}],"cordova-plugin-file.Flags":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/**
 * Supplies arguments to methods that lookup or create files and directories.
 *
 * @param create
 *            {boolean} file or directory if it doesn't exist
 * @param exclusive
 *            {boolean} used with create; if true the command will fail if
 *            target path exists
 */
function Flags (create, exclusive) {
    this.create = create || false;
    this.exclusive = exclusive || false;
}

module.exports = Flags;

},{}],"cordova-plugin-file.LocalFileSystem":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

exports.TEMPORARY = 0;
exports.PERSISTENT = 1;

},{}],"cordova-plugin-file.Metadata":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/**
 * Information about the state of the file or directory
 *
 * {Date} modificationTime (readonly)
 */
var Metadata = function (metadata) {
    if (typeof metadata === 'object') {
        this.modificationTime = new Date(metadata.modificationTime);
        this.size = metadata.size || 0;
    } else if (typeof metadata === 'undefined') {
        this.modificationTime = null;
        this.size = 0;
    } else {
        /* Backwards compatiblity with platforms that only return a timestamp */
        this.modificationTime = new Date(metadata);
    }
};

module.exports = Metadata;

},{}],"cordova-plugin-file.Preparing":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

(function () {
    /* global require */

    // Only Chrome uses this file.
    if (!require('cordova-plugin-file.isChrome')()) {
        return;
    }

    var channel = require('cordova/channel');
    var FileError = require('cordova-plugin-file.FileError');
    var PERSISTENT_FS_QUOTA = 5 * 1024 * 1024;
    var filePluginIsReadyEvent = new Event('filePluginIsReady'); // eslint-disable-line no-undef

    var entryFunctionsCreated = false;
    var quotaWasRequested = false;
    var eventWasThrown = false;

    if (!window.requestFileSystem) {
        window.requestFileSystem = function (type, size, win, fail) {
            if (fail) {
                fail('Not supported');
            }
        };
    } else {
        window.requestFileSystem(window.TEMPORARY, 1, createFileEntryFunctions, function () {});
    }

    if (!window.resolveLocalFileSystemURL) {
        window.resolveLocalFileSystemURL = function (url, win, fail) {
            if (fail) {
                fail('Not supported');
            }
        };
    }

    // Resolves a filesystem entry by its path - which is passed either in standard (filesystem:file://) or
    // Cordova-specific (cdvfile://) universal way.
    // Aligns with specification: http://www.w3.org/TR/2011/WD-file-system-api-20110419/#widl-LocalFileSystem-resolveLocalFileSystemURL
    var nativeResolveLocalFileSystemURL = window.resolveLocalFileSystemURL || window.webkitResolveLocalFileSystemURL;
    window.resolveLocalFileSystemURL = function (url, win, fail) {
        /* If url starts with `cdvfile` then we need convert it to Chrome real url first:
          cdvfile://localhost/persistent/path/to/file -> filesystem:file://persistent/path/to/file */
        if (url.trim().substr(0, 7) === 'cdvfile') {
            /* Quirk:
            Plugin supports cdvfile://localhost (local resources) only.
            I.e. external resources are not supported via cdvfile. */
            if (url.indexOf('cdvfile://localhost') !== -1) {
                // Browser supports temporary and persistent only
                var indexPersistent = url.indexOf('persistent');
                var indexTemporary = url.indexOf('temporary');

                /* Chrome urls start with 'filesystem:' prefix. See quirk:
                   toURL function in Chrome returns filesystem:-prefixed path depending on application host.
                   For example, filesystem:file:///persistent/somefile.txt,
                   filesystem:http://localhost:8080/persistent/somefile.txt. */
                var prefix = 'filesystem:file:///';
                if (location.protocol !== 'file:') { // eslint-disable-line no-undef
                    prefix = 'filesystem:' + location.origin + '/'; // eslint-disable-line no-undef
                }

                var result;
                if (indexPersistent !== -1) {
                    // cdvfile://localhost/persistent/path/to/file -> filesystem:file://persistent/path/to/file
                    // or filesystem:http://localhost:8080/persistent/path/to/file
                    result = prefix + 'persistent' + url.substr(indexPersistent + 10);
                    nativeResolveLocalFileSystemURL(result, win, fail);
                    return;
                }

                if (indexTemporary !== -1) {
                    // cdvfile://localhost/temporary/path/to/file -> filesystem:file://temporary/path/to/file
                    // or filesystem:http://localhost:8080/temporary/path/to/file
                    result = prefix + 'temporary' + url.substr(indexTemporary + 9);
                    nativeResolveLocalFileSystemURL(result, win, fail);
                    return;
                }
            }

            // cdvfile other than local file resource is not supported
            if (fail) {
                fail(new FileError(FileError.ENCODING_ERR));
            }
        } else {
            nativeResolveLocalFileSystemURL(url, win, fail);
        }
    };

    function createFileEntryFunctions (fs) {
        fs.root.getFile('todelete_658674_833_4_cdv', {create: true}, function (fileEntry) {
            var fileEntryType = Object.getPrototypeOf(fileEntry);
            var entryType = Object.getPrototypeOf(fileEntryType);

            // Save the original method
            var origToURL = entryType.toURL;
            entryType.toURL = function () {
                var origURL = origToURL.call(this);
                if (this.isDirectory && origURL.substr(-1) !== '/') {
                    return origURL + '/';
                }
                return origURL;
            };

            entryType.toNativeURL = function () {
                console.warn("DEPRECATED: Update your code to use 'toURL'");
                return this.toURL();
            };

            entryType.toInternalURL = function () {
                if (this.toURL().indexOf('persistent') > -1) {
                    return 'cdvfile://localhost/persistent' + this.fullPath;
                }

                if (this.toURL().indexOf('temporary') > -1) {
                    return 'cdvfile://localhost/temporary' + this.fullPath;
                }
            };

            entryType.setMetadata = function (win, fail /*, metadata */) {
                if (fail) {
                    fail('Not supported');
                }
            };

            fileEntry.createWriter(function (writer) {
                var originalWrite = writer.write;
                var writerProto = Object.getPrototypeOf(writer);
                writerProto.write = function (blob) {
                    if (blob instanceof Blob) { // eslint-disable-line no-undef
                        originalWrite.apply(this, [blob]);
                    } else {
                        var realBlob = new Blob([blob]); // eslint-disable-line no-undef
                        originalWrite.apply(this, [realBlob]);
                    }
                };

                fileEntry.remove(function () { entryFunctionsCreated = true; }, function () { /* empty callback */ });
            });
        });
    }

    window.initPersistentFileSystem = function (size, win, fail) {
        if (navigator.webkitPersistentStorage) {
            navigator.webkitPersistentStorage.requestQuota(size, win, fail);
            return;
        }

        fail('This browser does not support this function');
    };

    window.isFilePluginReadyRaised = function () { return eventWasThrown; };

    window.initPersistentFileSystem(PERSISTENT_FS_QUOTA, function () {
        console.log('Persistent fs quota granted');
        quotaWasRequested = true;
    }, function (e) {
        console.log('Error occured while trying to request Persistent fs quota: ' + JSON.stringify(e));
    });

    channel.onCordovaReady.subscribe(function () {
        function dispatchEventIfReady () {
            if (entryFunctionsCreated && quotaWasRequested) {
                window.dispatchEvent(filePluginIsReadyEvent);
                eventWasThrown = true;
            } else {
                setTimeout(dispatchEventIfReady, 100);
            }
        }

        dispatchEventIfReady();
    }, false);
})();

},{"cordova-plugin-file.FileError":"cordova-plugin-file.FileError","cordova-plugin-file.isChrome":"cordova-plugin-file.isChrome","cordova/channel":"cordova/channel"}],"cordova-plugin-file.ProgressEvent":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

// If ProgressEvent exists in global context, use it already, otherwise use our own polyfill
// Feature test: See if we can instantiate a native ProgressEvent;
// if so, use that approach,
// otherwise fill-in with our own implementation.
//
// NOTE: right now we always fill in with our own. Down the road would be nice if we can use whatever is native in the webview.
var ProgressEvent = (function () {
    /*
    var createEvent = function(data) {
        var event = document.createEvent('Events');
        event.initEvent('ProgressEvent', false, false);
        if (data) {
            for (var i in data) {
                if (data.hasOwnProperty(i)) {
                    event[i] = data[i];
                }
            }
            if (data.target) {
                // TODO: cannot call <some_custom_object>.dispatchEvent
                // need to first figure out how to implement EventTarget
            }
        }
        return event;
    };
    try {
        var ev = createEvent({type:"abort",target:document});
        return function ProgressEvent(type, data) {
            data.type = type;
            return createEvent(data);
        };
    } catch(e){
    */
    return function ProgressEvent (type, dict) {
        this.type = type;
        this.bubbles = false;
        this.cancelBubble = false;
        this.cancelable = false;
        this.lengthComputable = false;
        this.loaded = dict && dict.loaded ? dict.loaded : 0;
        this.total = dict && dict.total ? dict.total : 0;
        this.target = dict && dict.target ? dict.target : null;
    };
    // }
})();

module.exports = ProgressEvent;

},{}],"cordova-plugin-file.browserFileProxy":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */
(function () {
    /* global require, exports, module */
    /* global FILESYSTEM_PREFIX */
    /* global IDBKeyRange */

    /* Heavily based on https://github.com/ebidel/idb.filesystem.js */

    // For chrome we don't need to implement proxy methods
    // All functionality can be accessed natively.
    if (require('cordova-plugin-file.isChrome')()) {
        var pathsPrefix = {
            // Read-only directory where the application is installed.
            applicationDirectory: location.origin + '/', // eslint-disable-line no-undef
            // Where to put app-specific data files.
            dataDirectory: 'filesystem:file:///persistent/',
            // Cached files that should survive app restarts.
            // Apps should not rely on the OS to delete files in here.
            cacheDirectory: 'filesystem:file:///temporary/'
        };

        exports.requestAllPaths = function (successCallback) {
            successCallback(pathsPrefix);
        };

        require('cordova/exec/proxy').add('File', module.exports);
        return;
    }

    var LocalFileSystem = require('cordova-plugin-file.LocalFileSystem');
    var FileSystem = require('cordova-plugin-file.FileSystem');
    var FileEntry = require('cordova-plugin-file.FileEntry');
    var FileError = require('cordova-plugin-file.FileError');
    var DirectoryEntry = require('cordova-plugin-file.DirectoryEntry');
    var File = require('cordova-plugin-file.File');

    (function (exports, global) {
        var indexedDB = global.indexedDB || global.mozIndexedDB;
        if (!indexedDB) {
            throw 'Firefox OS File plugin: indexedDB not supported';
        }

        var fs_ = null;

        var idb_ = {};
        idb_.db = null;
        var FILE_STORE_ = 'entries';

        var DIR_SEPARATOR = '/';

        var pathsPrefix = {
            // Read-only directory where the application is installed.
            applicationDirectory: location.origin + '/', // eslint-disable-line no-undef
            // Where to put app-specific data files.
            dataDirectory: 'file:///persistent/',
            // Cached files that should survive app restarts.
            // Apps should not rely on the OS to delete files in here.
            cacheDirectory: 'file:///temporary/'
        };

        var unicodeLastChar = 65535;

    /** * Exported functionality ***/

        exports.requestFileSystem = function (successCallback, errorCallback, args) {
            var type = args[0];
            // Size is ignored since IDB filesystem size depends
            // on browser implementation and can't be set up by user
            var size = args[1]; // eslint-disable-line no-unused-vars

            if (type !== LocalFileSystem.TEMPORARY && type !== LocalFileSystem.PERSISTENT) {
                if (errorCallback) {
                    errorCallback(FileError.INVALID_MODIFICATION_ERR);
                }
                return;
            }

            var name = type === LocalFileSystem.TEMPORARY ? 'temporary' : 'persistent';
            var storageName = (location.protocol + location.host).replace(/:/g, '_'); // eslint-disable-line no-undef

            var root = new DirectoryEntry('', DIR_SEPARATOR);
            fs_ = new FileSystem(name, root);

            idb_.open(storageName, function () {
                successCallback(fs_);
            }, errorCallback);
        };

        // Overridden by Android, BlackBerry 10 and iOS to populate fsMap
        require('cordova-plugin-file.fileSystems').getFs = function (name, callback) {
            callback(new FileSystem(name, fs_.root));
        };

        // list a directory's contents (files and folders).
        exports.readEntries = function (successCallback, errorCallback, args) {
            var fullPath = args[0];

            if (typeof successCallback !== 'function') {
                throw Error('Expected successCallback argument.');
            }

            var path = resolveToFullPath_(fullPath);

            exports.getDirectory(function () {
                idb_.getAllEntries(path.fullPath + DIR_SEPARATOR, path.storagePath, function (entries) {
                    successCallback(entries);
                }, errorCallback);
            }, function () {
                if (errorCallback) {
                    errorCallback(FileError.NOT_FOUND_ERR);
                }
            }, [path.storagePath, path.fullPath, {create: false}]);
        };

        exports.getFile = function (successCallback, errorCallback, args) {
            var fullPath = args[0];
            var path = args[1];
            var options = args[2] || {};

            // Create an absolute path if we were handed a relative one.
            path = resolveToFullPath_(fullPath, path);

            idb_.get(path.storagePath, function (fileEntry) {
                if (options.create === true && options.exclusive === true && fileEntry) {
                    // If create and exclusive are both true, and the path already exists,
                    // getFile must fail.

                    if (errorCallback) {
                        errorCallback(FileError.PATH_EXISTS_ERR);
                    }
                } else if (options.create === true && !fileEntry) {
                    // If create is true, the path doesn't exist, and no other error occurs,
                    // getFile must create it as a zero-length file and return a corresponding
                    // FileEntry.
                    var newFileEntry = new FileEntry(path.fileName, path.fullPath, new FileSystem(path.fsName, fs_.root));

                    newFileEntry.file_ = new MyFile({
                        size: 0,
                        name: newFileEntry.name,
                        lastModifiedDate: new Date(),
                        storagePath: path.storagePath
                    });

                    idb_.put(newFileEntry, path.storagePath, successCallback, errorCallback);
                } else if (options.create === true && fileEntry) {
                    if (fileEntry.isFile) {
                        // Overwrite file, delete then create new.
                        idb_['delete'](path.storagePath, function () {
                            var newFileEntry = new FileEntry(path.fileName, path.fullPath, new FileSystem(path.fsName, fs_.root));

                            newFileEntry.file_ = new MyFile({
                                size: 0,
                                name: newFileEntry.name,
                                lastModifiedDate: new Date(),
                                storagePath: path.storagePath
                            });

                            idb_.put(newFileEntry, path.storagePath, successCallback, errorCallback);
                        }, errorCallback);
                    } else {
                        if (errorCallback) {
                            errorCallback(FileError.INVALID_MODIFICATION_ERR);
                        }
                    }
                } else if ((!options.create || options.create === false) && !fileEntry) {
                    // If create is not true and the path doesn't exist, getFile must fail.
                    if (errorCallback) {
                        errorCallback(FileError.NOT_FOUND_ERR);
                    }
                } else if ((!options.create || options.create === false) && fileEntry &&
                    fileEntry.isDirectory) {
                    // If create is not true and the path exists, but is a directory, getFile
                    // must fail.
                    if (errorCallback) {
                        errorCallback(FileError.TYPE_MISMATCH_ERR);
                    }
                } else {
                    // Otherwise, if no other error occurs, getFile must return a FileEntry
                    // corresponding to path.

                    successCallback(fileEntryFromIdbEntry(fileEntry));
                }
            }, errorCallback);
        };

        exports.getFileMetadata = function (successCallback, errorCallback, args) {
            var fullPath = args[0];

            exports.getFile(function (fileEntry) {
                successCallback(new File(fileEntry.file_.name, fileEntry.fullPath, '', fileEntry.file_.lastModifiedDate,
                    fileEntry.file_.size));
            }, errorCallback, [fullPath, null]);
        };

        exports.getMetadata = function (successCallback, errorCallback, args) {
            exports.getFile(function (fileEntry) {
                successCallback(
                    {
                        modificationTime: fileEntry.file_.lastModifiedDate,
                        size: fileEntry.file_.lastModifiedDate
                    });
            }, errorCallback, args);
        };

        exports.setMetadata = function (successCallback, errorCallback, args) {
            var fullPath = args[0];
            var metadataObject = args[1];

            exports.getFile(function (fileEntry) {
                fileEntry.file_.lastModifiedDate = metadataObject.modificationTime;
                idb_.put(fileEntry, fileEntry.file_.storagePath, successCallback, errorCallback);
            }, errorCallback, [fullPath, null]);
        };

        exports.write = function (successCallback, errorCallback, args) {
            var fileName = args[0];
            var data = args[1];
            var position = args[2];
            var isBinary = args[3]; // eslint-disable-line no-unused-vars

            if (!data) {
                if (errorCallback) {
                    errorCallback(FileError.INVALID_MODIFICATION_ERR);
                }
                return;
            }

            if (typeof data === 'string' || data instanceof String) {
                data = new Blob([data]); // eslint-disable-line no-undef
            }

            exports.getFile(function (fileEntry) {
                var blob_ = fileEntry.file_.blob_;

                if (!blob_) {
                    blob_ = new Blob([data], {type: data.type}); // eslint-disable-line no-undef
                } else {
                    // Calc the head and tail fragments
                    var head = blob_.slice(0, position);
                    var tail = blob_.slice(position + (data.size || data.byteLength));

                    // Calc the padding
                    var padding = position - head.size;
                    if (padding < 0) {
                        padding = 0;
                    }

                    // Do the "write". In fact, a full overwrite of the Blob.
                    blob_ = new Blob([head, new Uint8Array(padding), data, tail], // eslint-disable-line no-undef
                        {type: data.type});
                }

                // Set the blob we're writing on this file entry so we can recall it later.
                fileEntry.file_.blob_ = blob_;
                fileEntry.file_.lastModifiedDate = new Date() || null;
                fileEntry.file_.size = blob_.size;
                fileEntry.file_.name = blob_.name;
                fileEntry.file_.type = blob_.type;

                idb_.put(fileEntry, fileEntry.file_.storagePath, function () {
                    successCallback(data.size || data.byteLength);
                }, errorCallback);
            }, errorCallback, [fileName, null]);
        };

        exports.readAsText = function (successCallback, errorCallback, args) {
            var fileName = args[0];
            var enc = args[1];
            var startPos = args[2];
            var endPos = args[3];

            readAs('text', fileName, enc, startPos, endPos, successCallback, errorCallback);
        };

        exports.readAsDataURL = function (successCallback, errorCallback, args) {
            var fileName = args[0];
            var startPos = args[1];
            var endPos = args[2];

            readAs('dataURL', fileName, null, startPos, endPos, successCallback, errorCallback);
        };

        exports.readAsBinaryString = function (successCallback, errorCallback, args) {
            var fileName = args[0];
            var startPos = args[1];
            var endPos = args[2];

            readAs('binaryString', fileName, null, startPos, endPos, successCallback, errorCallback);
        };

        exports.readAsArrayBuffer = function (successCallback, errorCallback, args) {
            var fileName = args[0];
            var startPos = args[1];
            var endPos = args[2];

            readAs('arrayBuffer', fileName, null, startPos, endPos, successCallback, errorCallback);
        };

        exports.removeRecursively = exports.remove = function (successCallback, errorCallback, args) {
            if (typeof successCallback !== 'function') {
                throw Error('Expected successCallback argument.');
            }

            var fullPath = resolveToFullPath_(args[0]).storagePath;
            if (fullPath === pathsPrefix.cacheDirectory || fullPath === pathsPrefix.dataDirectory) {
                errorCallback(FileError.NO_MODIFICATION_ALLOWED_ERR);
                return;
            }

            function deleteEntry (isDirectory) {
                // TODO: This doesn't protect against directories that have content in it.
                // Should throw an error instead if the dirEntry is not empty.
                idb_['delete'](fullPath, function () {
                    successCallback();
                }, function () {
                    if (errorCallback) { errorCallback(); }
                }, isDirectory);
            }

            // We need to to understand what we are deleting:
            exports.getDirectory(function (entry) {
                deleteEntry(entry.isDirectory);
            }, function () {
                // DirectoryEntry was already deleted or entry is FileEntry
                deleteEntry(false);
            }, [fullPath, null, {create: false}]);
        };

        exports.getDirectory = function (successCallback, errorCallback, args) {
            var fullPath = args[0];
            var path = args[1];
            var options = args[2];

            // Create an absolute path if we were handed a relative one.
            path = resolveToFullPath_(fullPath, path);

            idb_.get(path.storagePath, function (folderEntry) {
                if (!options) {
                    options = {};
                }

                if (options.create === true && options.exclusive === true && folderEntry) {
                    // If create and exclusive are both true, and the path already exists,
                    // getDirectory must fail.
                    if (errorCallback) {
                        errorCallback(FileError.PATH_EXISTS_ERR);
                    }
                    // There is a strange bug in mobilespec + FF, which results in coming to multiple else-if's
                    // so we are shielding from it with returns.
                    return;
                }

                if (options.create === true && !folderEntry) {
                    // If create is true, the path doesn't exist, and no other error occurs,
                    // getDirectory must create it as a zero-length file and return a corresponding
                    // MyDirectoryEntry.
                    var dirEntry = new DirectoryEntry(path.fileName, path.fullPath, new FileSystem(path.fsName, fs_.root));

                    idb_.put(dirEntry, path.storagePath, successCallback, errorCallback);
                    return;
                }

                if (options.create === true && folderEntry) {

                    if (folderEntry.isDirectory) {
                        // IDB won't save methods, so we need re-create the MyDirectoryEntry.
                        successCallback(new DirectoryEntry(folderEntry.name, folderEntry.fullPath, folderEntry.filesystem));
                    } else {
                        if (errorCallback) {
                            errorCallback(FileError.INVALID_MODIFICATION_ERR);
                        }
                    }
                    return;
                }

                if ((!options.create || options.create === false) && !folderEntry) {
                    // Handle root special. It should always exist.
                    if (path.fullPath === DIR_SEPARATOR) {
                        successCallback(fs_.root);
                        return;
                    }

                    // If create is not true and the path doesn't exist, getDirectory must fail.
                    if (errorCallback) {
                        errorCallback(FileError.NOT_FOUND_ERR);
                    }

                    return;
                }
                if ((!options.create || options.create === false) && folderEntry && folderEntry.isFile) {
                    // If create is not true and the path exists, but is a file, getDirectory
                    // must fail.
                    if (errorCallback) {
                        errorCallback(FileError.TYPE_MISMATCH_ERR);
                    }
                    return;
                }

                // Otherwise, if no other error occurs, getDirectory must return a
                // MyDirectoryEntry corresponding to path.

                // IDB won't' save methods, so we need re-create MyDirectoryEntry.
                successCallback(new DirectoryEntry(folderEntry.name, folderEntry.fullPath, folderEntry.filesystem));
            }, errorCallback);
        };

        exports.getParent = function (successCallback, errorCallback, args) {
            if (typeof successCallback !== 'function') {
                throw Error('Expected successCallback argument.');
            }

            var fullPath = args[0];
            // fullPath is like this:
            // file:///persistent/path/to/file or
            // file:///persistent/path/to/directory/

            if (fullPath === DIR_SEPARATOR || fullPath === pathsPrefix.cacheDirectory ||
                fullPath === pathsPrefix.dataDirectory) {
                successCallback(fs_.root);
                return;
            }

            // To delete all slashes at the end
            while (fullPath[fullPath.length - 1] === '/') {
                fullPath = fullPath.substr(0, fullPath.length - 1);
            }

            var pathArr = fullPath.split(DIR_SEPARATOR);
            pathArr.pop();
            var parentName = pathArr.pop();
            var path = pathArr.join(DIR_SEPARATOR) + DIR_SEPARATOR;

            // To get parent of root files
            var joined = path + parentName + DIR_SEPARATOR;// is like this: file:///persistent/
            if (joined === pathsPrefix.cacheDirectory || joined === pathsPrefix.dataDirectory) {
                exports.getDirectory(successCallback, errorCallback, [joined, DIR_SEPARATOR, {create: false}]);
                return;
            }

            exports.getDirectory(successCallback, errorCallback, [path, parentName, {create: false}]);
        };

        exports.copyTo = function (successCallback, errorCallback, args) {
            var srcPath = args[0];
            var parentFullPath = args[1];
            var name = args[2];

            if (name.indexOf('/') !== -1 || srcPath === parentFullPath + name) {
                if (errorCallback) {
                    errorCallback(FileError.INVALID_MODIFICATION_ERR);
                }

                return;
            }

            // Read src file
            exports.getFile(function (srcFileEntry) {

                var path = resolveToFullPath_(parentFullPath);
                // Check directory
                exports.getDirectory(function () {

                    // Create dest file
                    exports.getFile(function (dstFileEntry) {

                        exports.write(function () {
                            successCallback(dstFileEntry);
                        }, errorCallback, [dstFileEntry.file_.storagePath, srcFileEntry.file_.blob_, 0]);

                    }, errorCallback, [parentFullPath, name, {create: true}]);

                }, function () { if (errorCallback) { errorCallback(FileError.NOT_FOUND_ERR); } },
                [path.storagePath, null, {create: false}]);

            }, errorCallback, [srcPath, null]);
        };

        exports.moveTo = function (successCallback, errorCallback, args) {
            var srcPath = args[0];
            // parentFullPath and name parameters is ignored because
            // args is being passed downstream to exports.copyTo method
            var parentFullPath = args[1]; // eslint-disable-line
            var name = args[2]; // eslint-disable-line

            exports.copyTo(function (fileEntry) {

                exports.remove(function () {
                    successCallback(fileEntry);
                }, errorCallback, [srcPath]);

            }, errorCallback, args);
        };

        exports.resolveLocalFileSystemURI = function (successCallback, errorCallback, args) {
            var path = args[0];

            // Ignore parameters
            if (path.indexOf('?') !== -1) {
                path = String(path).split('?')[0];
            }

            // support for encodeURI
            if (/\%5/g.test(path) || /\%20/g.test(path)) {  // eslint-disable-line no-useless-escape
                path = decodeURI(path);
            }

            if (path.trim()[0] === '/') {
                if (errorCallback) {
                    errorCallback(FileError.ENCODING_ERR);
                }
                return;
            }

            // support for cdvfile
            if (path.trim().substr(0, 7) === 'cdvfile') {
                if (path.indexOf('cdvfile://localhost') === -1) {
                    if (errorCallback) {
                        errorCallback(FileError.ENCODING_ERR);
                    }
                    return;
                }

                var indexPersistent = path.indexOf('persistent');
                var indexTemporary = path.indexOf('temporary');

                // cdvfile://localhost/persistent/path/to/file
                if (indexPersistent !== -1) {
                    path = 'file:///persistent' + path.substr(indexPersistent + 10);
                } else if (indexTemporary !== -1) {
                    path = 'file:///temporary' + path.substr(indexTemporary + 9);
                } else {
                    if (errorCallback) {
                        errorCallback(FileError.ENCODING_ERR);
                    }
                    return;
                }
            }

            // to avoid path form of '///path/to/file'
            function handlePathSlashes (path) {
                var cutIndex = 0;
                for (var i = 0; i < path.length - 1; i++) {
                    if (path[i] === DIR_SEPARATOR && path[i + 1] === DIR_SEPARATOR) {
                        cutIndex = i + 1;
                    } else break;
                }

                return path.substr(cutIndex);
            }

            // Handle localhost containing paths (see specs )
            if (path.indexOf('file://localhost/') === 0) {
                path = path.replace('file://localhost/', 'file:///');
            }

            if (path.indexOf(pathsPrefix.dataDirectory) === 0) {
                path = path.substring(pathsPrefix.dataDirectory.length - 1);
                path = handlePathSlashes(path);

                exports.requestFileSystem(function () {
                    exports.getFile(successCallback, function () {
                        exports.getDirectory(successCallback, errorCallback, [pathsPrefix.dataDirectory, path,
                        {create: false}]);
                    }, [pathsPrefix.dataDirectory, path, {create: false}]);
                }, errorCallback, [LocalFileSystem.PERSISTENT]);
            } else if (path.indexOf(pathsPrefix.cacheDirectory) === 0) {
                path = path.substring(pathsPrefix.cacheDirectory.length - 1);
                path = handlePathSlashes(path);

                exports.requestFileSystem(function () {
                    exports.getFile(successCallback, function () {
                        exports.getDirectory(successCallback, errorCallback, [pathsPrefix.cacheDirectory, path,
                        {create: false}]);
                    }, [pathsPrefix.cacheDirectory, path, {create: false}]);
                }, errorCallback, [LocalFileSystem.TEMPORARY]);
            } else if (path.indexOf(pathsPrefix.applicationDirectory) === 0) {
                path = path.substring(pathsPrefix.applicationDirectory.length);
                // TODO: need to cut out redundant slashes?

                var xhr = new XMLHttpRequest(); // eslint-disable-line no-undef
                xhr.open('GET', path, true);
                xhr.onreadystatechange = function () {
                    if (xhr.status === 200 && xhr.readyState === 4) {
                        exports.requestFileSystem(function (fs) {
                            fs.name = location.hostname; // eslint-disable-line no-undef

                            // TODO: need to call exports.getFile(...) to handle errors correct
                            fs.root.getFile(path, {create: true}, writeFile, errorCallback);
                        }, errorCallback, [LocalFileSystem.PERSISTENT]);
                    }
                };

                xhr.onerror = function () {
                    if (errorCallback) {
                        errorCallback(FileError.NOT_READABLE_ERR);
                    }
                };

                xhr.send();
            } else {
                if (errorCallback) {
                    errorCallback(FileError.NOT_FOUND_ERR);
                }
            }

            function writeFile (entry) {
                entry.createWriter(function (fileWriter) {
                    fileWriter.onwriteend = function (evt) {
                        if (!evt.target.error) {
                            entry.filesystemName = location.hostname; // eslint-disable-line no-undef
                            successCallback(entry);
                        }
                    };
                    fileWriter.onerror = function () {
                        if (errorCallback) {
                            errorCallback(FileError.NOT_READABLE_ERR);
                        }
                    };
                    fileWriter.write(new Blob([xhr.response])); // eslint-disable-line no-undef
                }, errorCallback); // eslint-disable-line no-undef
            }
        };

        exports.requestAllPaths = function (successCallback) {
            successCallback(pathsPrefix);
        };

    /** * Helpers ***/

        /**
         * Interface to wrap the native File interface.
         *
         * This interface is necessary for creating zero-length (empty) files,
         * something the Filesystem API allows you to do. Unfortunately, File's
         * constructor cannot be called directly, making it impossible to instantiate
         * an empty File in JS.
         *
         * @param {Object} opts Initial values.
         * @constructor
         */
        function MyFile (opts) {
            var blob_ = new Blob(); // eslint-disable-line no-undef

            this.size = opts.size || 0;
            this.name = opts.name || '';
            this.type = opts.type || '';
            this.lastModifiedDate = opts.lastModifiedDate || null;
            this.storagePath = opts.storagePath || '';

            // Need some black magic to correct the object's size/name/type based on the
            // blob that is saved.
            Object.defineProperty(this, 'blob_', {
                enumerable: true,
                get: function () {
                    return blob_;
                },
                set: function (val) {
                    blob_ = val;
                    this.size = blob_.size;
                    this.name = blob_.name;
                    this.type = blob_.type;
                    this.lastModifiedDate = blob_.lastModifiedDate;
                }.bind(this)
            });
        }

        MyFile.prototype.constructor = MyFile;

        // When saving an entry, the fullPath should always lead with a slash and never
        // end with one (e.g. a directory). Also, resolve '.' and '..' to an absolute
        // one. This method ensures path is legit!
        function resolveToFullPath_ (cwdFullPath, path) {
            path = path || '';
            var fullPath = path;
            var prefix = '';

            cwdFullPath = cwdFullPath || DIR_SEPARATOR;
            if (cwdFullPath.indexOf(FILESYSTEM_PREFIX) === 0) {
                prefix = cwdFullPath.substring(0, cwdFullPath.indexOf(DIR_SEPARATOR, FILESYSTEM_PREFIX.length));
                cwdFullPath = cwdFullPath.substring(cwdFullPath.indexOf(DIR_SEPARATOR, FILESYSTEM_PREFIX.length));
            }

            var relativePath = path[0] !== DIR_SEPARATOR;
            if (relativePath) {
                fullPath = cwdFullPath;
                if (cwdFullPath !== DIR_SEPARATOR) {
                    fullPath += DIR_SEPARATOR + path;
                } else {
                    fullPath += path;
                }
            }

            // Remove doubled separator substrings
            var re = new RegExp(DIR_SEPARATOR + DIR_SEPARATOR, 'g');
            fullPath = fullPath.replace(re, DIR_SEPARATOR);

            // Adjust '..'s by removing parent directories when '..' flows in path.
            var parts = fullPath.split(DIR_SEPARATOR);
            for (var i = 0; i < parts.length; ++i) {
                var part = parts[i];
                if (part === '..') {
                    parts[i - 1] = '';
                    parts[i] = '';
                }
            }
            fullPath = parts.filter(function (el) {
                return el;
            }).join(DIR_SEPARATOR);

            // Add back in leading slash.
            if (fullPath[0] !== DIR_SEPARATOR) {
                fullPath = DIR_SEPARATOR + fullPath;
            }

            // Replace './' by current dir. ('./one/./two' -> one/two)
            fullPath = fullPath.replace(/\.\//g, DIR_SEPARATOR);

            // Replace '//' with '/'.
            fullPath = fullPath.replace(/\/\//g, DIR_SEPARATOR);

            // Replace '/.' with '/'.
            fullPath = fullPath.replace(/\/\./g, DIR_SEPARATOR);

            // Remove '/' if it appears on the end.
            if (fullPath[fullPath.length - 1] === DIR_SEPARATOR &&
                fullPath !== DIR_SEPARATOR) {
                fullPath = fullPath.substring(0, fullPath.length - 1);
            }

            var storagePath = prefix + fullPath;
            storagePath = decodeURI(storagePath);
            fullPath = decodeURI(fullPath);

            return {
                storagePath: storagePath,
                fullPath: fullPath,
                fileName: fullPath.split(DIR_SEPARATOR).pop(),
                fsName: prefix.split(DIR_SEPARATOR).pop()
            };
        }

        function fileEntryFromIdbEntry (fileEntry) {
            // IDB won't save methods, so we need re-create the FileEntry.
            var clonedFileEntry = new FileEntry(fileEntry.name, fileEntry.fullPath, fileEntry.filesystem);
            clonedFileEntry.file_ = fileEntry.file_;

            return clonedFileEntry;
        }

        function readAs (what, fullPath, encoding, startPos, endPos, successCallback, errorCallback) {
            exports.getFile(function (fileEntry) {
                var fileReader = new FileReader(); // eslint-disable-line no-undef
                var blob = fileEntry.file_.blob_.slice(startPos, endPos);

                fileReader.onload = function (e) {
                    successCallback(e.target.result);
                };

                fileReader.onerror = errorCallback;

                switch (what) {
                case 'text':
                    fileReader.readAsText(blob, encoding);
                    break;
                case 'dataURL':
                    fileReader.readAsDataURL(blob);
                    break;
                case 'arrayBuffer':
                    fileReader.readAsArrayBuffer(blob);
                    break;
                case 'binaryString':
                    fileReader.readAsBinaryString(blob);
                    break;
                }

            }, errorCallback, [fullPath, null]);
        }

    /** * Core logic to handle IDB operations ***/

        idb_.open = function (dbName, successCallback, errorCallback) {
            var self = this;

            // TODO: FF 12.0a1 isn't liking a db name with : in it.
            var request = indexedDB.open(dbName.replace(':', '_')/*, 1 /*version */);

            request.onerror = errorCallback || onError;

            request.onupgradeneeded = function (e) {
                // First open was called or higher db version was used.

                // console.log('onupgradeneeded: oldVersion:' + e.oldVersion,
                //           'newVersion:' + e.newVersion);

                self.db = e.target.result;
                self.db.onerror = onError;

                if (!self.db.objectStoreNames.contains(FILE_STORE_)) {
                    self.db.createObjectStore(FILE_STORE_/*, {keyPath: 'id', autoIncrement: true} */);
                }
            };

            request.onsuccess = function (e) {
                self.db = e.target.result;
                self.db.onerror = onError;
                successCallback(e);
            };

            request.onblocked = errorCallback || onError;
        };

        idb_.close = function () {
            this.db.close();
            this.db = null;
        };

        idb_.get = function (fullPath, successCallback, errorCallback) {
            if (!this.db) {
                if (errorCallback) {
                    errorCallback(FileError.INVALID_MODIFICATION_ERR);
                }
                return;
            }

            var tx = this.db.transaction([FILE_STORE_], 'readonly');

            var request = tx.objectStore(FILE_STORE_).get(fullPath);

            tx.onabort = errorCallback || onError;
            tx.oncomplete = function () {
                successCallback(request.result);
            };
        };

        idb_.getAllEntries = function (fullPath, storagePath, successCallback, errorCallback) {
            if (!this.db) {
                if (errorCallback) {
                    errorCallback(FileError.INVALID_MODIFICATION_ERR);
                }
                return;
            }

            var results = [];

            if (storagePath[storagePath.length - 1] === DIR_SEPARATOR) {
                storagePath = storagePath.substring(0, storagePath.length - 1);
            }

            var range = IDBKeyRange.bound(storagePath + DIR_SEPARATOR + ' ',
                storagePath + DIR_SEPARATOR + String.fromCharCode(unicodeLastChar));

            var tx = this.db.transaction([FILE_STORE_], 'readonly');
            tx.onabort = errorCallback || onError;
            tx.oncomplete = function () {
                results = results.filter(function (val) {
                    var pathWithoutSlash = val.fullPath;

                    if (val.fullPath[val.fullPath.length - 1] === DIR_SEPARATOR) {
                        pathWithoutSlash = pathWithoutSlash.substr(0, pathWithoutSlash.length - 1);
                    }

                    var valPartsLen = pathWithoutSlash.split(DIR_SEPARATOR).length;
                    var fullPathPartsLen = fullPath.split(DIR_SEPARATOR).length;

                    /* Input fullPath parameter  equals '//' for root folder */
                    /* Entries in root folder has valPartsLen equals 2 (see below) */
                    if (fullPath[fullPath.length - 1] === DIR_SEPARATOR && fullPath.trim().length === 2) {
                        fullPathPartsLen = 1;
                    } else if (fullPath[fullPath.length - 1] === DIR_SEPARATOR) {
                        fullPathPartsLen = fullPath.substr(0, fullPath.length - 1).split(DIR_SEPARATOR).length;
                    } else {
                        fullPathPartsLen = fullPath.split(DIR_SEPARATOR).length;
                    }

                    if (valPartsLen === fullPathPartsLen + 1) {
                        // If this a subfolder and entry is a direct child, include it in
                        // the results. Otherwise, it's not an entry of this folder.
                        return val;
                    } else return false;
                });

                successCallback(results);
            };

            var request = tx.objectStore(FILE_STORE_).openCursor(range);

            request.onsuccess = function (e) {
                var cursor = e.target.result;
                if (cursor) {
                    var val = cursor.value;

                    results.push(val.isFile ? fileEntryFromIdbEntry(val) : new DirectoryEntry(val.name, val.fullPath, val.filesystem));
                    cursor['continue']();
                }
            };
        };

        idb_['delete'] = function (fullPath, successCallback, errorCallback, isDirectory) {
            if (!idb_.db) {
                if (errorCallback) {
                    errorCallback(FileError.INVALID_MODIFICATION_ERR);
                }
                return;
            }

            var tx = this.db.transaction([FILE_STORE_], 'readwrite');
            tx.oncomplete = successCallback;
            tx.onabort = errorCallback || onError;
            tx.oncomplete = function () {
                if (isDirectory) {
                    // We delete nested files and folders after deleting parent folder
                    // We use ranges: https://developer.mozilla.org/en-US/docs/Web/API/IDBKeyRange
                    fullPath = fullPath + DIR_SEPARATOR;

                    // Range contains all entries in the form fullPath<symbol> where
                    // symbol in the range from ' ' to symbol which has code `unicodeLastChar`
                    var range = IDBKeyRange.bound(fullPath + ' ', fullPath + String.fromCharCode(unicodeLastChar));

                    var newTx = this.db.transaction([FILE_STORE_], 'readwrite');
                    newTx.oncomplete = successCallback;
                    newTx.onabort = errorCallback || onError;
                    newTx.objectStore(FILE_STORE_)['delete'](range);
                } else {
                    successCallback();
                }
            };
            tx.objectStore(FILE_STORE_)['delete'](fullPath);
        };

        idb_.put = function (entry, storagePath, successCallback, errorCallback) {
            if (!this.db) {
                if (errorCallback) {
                    errorCallback(FileError.INVALID_MODIFICATION_ERR);
                }
                return;
            }

            var tx = this.db.transaction([FILE_STORE_], 'readwrite');
            tx.onabort = errorCallback || onError;
            tx.oncomplete = function () {
                // TODO: Error is thrown if we pass the request event back instead.
                successCallback(entry);
            };

            tx.objectStore(FILE_STORE_).put(entry, storagePath);
        };

        // Global error handler. Errors bubble from request, to transaction, to db.
        function onError (e) {
            switch (e.target.errorCode) {
            case 12:
                console.log('Error - Attempt to open db with a lower version than the ' +
                        'current one.');
                break;
            default:
                console.log('errorCode: ' + e.target.errorCode);
            }

            console.log(e, e.code, e.message);
        }

    })(module.exports, window);

    require('cordova/exec/proxy').add('File', module.exports);
})();

},{"cordova-plugin-file.DirectoryEntry":"cordova-plugin-file.DirectoryEntry","cordova-plugin-file.File":"cordova-plugin-file.File","cordova-plugin-file.FileEntry":"cordova-plugin-file.FileEntry","cordova-plugin-file.FileError":"cordova-plugin-file.FileError","cordova-plugin-file.FileSystem":"cordova-plugin-file.FileSystem","cordova-plugin-file.LocalFileSystem":"cordova-plugin-file.LocalFileSystem","cordova-plugin-file.fileSystems":"cordova-plugin-file.fileSystems","cordova-plugin-file.isChrome":"cordova-plugin-file.isChrome","cordova/exec/proxy":"cordova/exec/proxy"}],"cordova-plugin-file.fileSystemPaths":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var exec = require('cordova/exec');
var channel = require('cordova/channel');

exports.file = {
    // Read-only directory where the application is installed.
    applicationDirectory: null,
    // Root of app's private writable storage
    applicationStorageDirectory: null,
    // Where to put app-specific data files.
    dataDirectory: null,
    // Cached files that should survive app restarts.
    // Apps should not rely on the OS to delete files in here.
    cacheDirectory: null,
    // Android: the application space on external storage.
    externalApplicationStorageDirectory: null,
    // Android: Where to put app-specific data files on external storage.
    externalDataDirectory: null,
    // Android: the application cache on external storage.
    externalCacheDirectory: null,
    // Android: the external storage (SD card) root.
    externalRootDirectory: null,
    // iOS: Temp directory that the OS can clear at will.
    tempDirectory: null,
    // iOS: Holds app-specific files that should be synced (e.g. to iCloud).
    syncedDataDirectory: null,
    // iOS: Files private to the app, but that are meaningful to other applications (e.g. Office files)
    documentsDirectory: null,
    // BlackBerry10: Files globally available to all apps
    sharedDirectory: null
};

channel.waitForInitialization('onFileSystemPathsReady');
channel.onCordovaReady.subscribe(function () {
    function after (paths) {
        for (var k in paths) {
            exports.file[k] = paths[k];
        }
        channel.initializationComplete('onFileSystemPathsReady');
    }
    exec(after, null, 'File', 'requestAllPaths', []);
});

},{"cordova/channel":"cordova/channel","cordova/exec":"cordova/exec"}],"cordova-plugin-file.fileSystems":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

// Overridden by Android, BlackBerry 10 and iOS to populate fsMap.
module.exports.getFs = function (name, callback) {
    callback(null);
};

},{}],"cordova-plugin-file.firefoxFileSystem":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/* global FILESYSTEM_PREFIX: true, module */

FILESYSTEM_PREFIX = 'file:///';

module.exports = {
    __format__: function (fullPath) {
        return (FILESYSTEM_PREFIX + this.name + (fullPath[0] === '/' ? '' : '/') + FileSystem.encodeURIPath(fullPath)); // eslint-disable-line no-undef
    }
};

},{}],"cordova-plugin-file.isChrome":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */

module.exports = function () {
    // window.webkitRequestFileSystem and window.webkitResolveLocalFileSystemURL are available only in Chrome and
    // possibly a good flag to indicate that we're running in Chrome
    return window.webkitRequestFileSystem && window.webkitResolveLocalFileSystemURL;
};

},{}],"cordova-plugin-file.requestFileSystem":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

(function () {
    // For browser platform: not all browsers use this file.
    function checkBrowser () {
        if (cordova.platformId === 'browser' && require('cordova-plugin-file.isChrome')()) { // eslint-disable-line no-undef
            module.exports = window.requestFileSystem || window.webkitRequestFileSystem;
            return true;
        }
        return false;
    }
    if (checkBrowser()) {
        return;
    }

    var argscheck = require('cordova/argscheck');
    var FileError = require('cordova-plugin-file.FileError');
    var FileSystem = require('cordova-plugin-file.FileSystem');
    var exec = require('cordova/exec');
    var fileSystems = require('cordova-plugin-file.fileSystems');

    /**
     * Request a file system in which to store application data.
     * @param type  local file system type
     * @param size  indicates how much storage space, in bytes, the application expects to need
     * @param successCallback  invoked with a FileSystem object
     * @param errorCallback  invoked if error occurs retrieving file system
     */
    var requestFileSystem = function (type, size, successCallback, errorCallback) {
        argscheck.checkArgs('nnFF', 'requestFileSystem', arguments);
        var fail = function (code) {
            if (errorCallback) {
                errorCallback(new FileError(code));
            }
        };

        if (type < 0) {
            fail(FileError.SYNTAX_ERR);
        } else {
            // if successful, return a FileSystem object
            var success = function (file_system) {
                if (file_system) {
                    if (successCallback) {
                        fileSystems.getFs(file_system.name, function (fs) {
                            // This should happen only on platforms that haven't implemented requestAllFileSystems (windows)
                            if (!fs) {
                                fs = new FileSystem(file_system.name, file_system.root);
                            }
                            successCallback(fs);
                        });
                    }
                } else {
                    // no FileSystem object returned
                    fail(FileError.NOT_FOUND_ERR);
                }
            };
            exec(success, fail, 'File', 'requestFileSystem', [type, size]);
        }
    };

    module.exports = requestFileSystem;
})();

},{"cordova-plugin-file.FileError":"cordova-plugin-file.FileError","cordova-plugin-file.FileSystem":"cordova-plugin-file.FileSystem","cordova-plugin-file.fileSystems":"cordova-plugin-file.fileSystems","cordova-plugin-file.isChrome":"cordova-plugin-file.isChrome","cordova/argscheck":"cordova/argscheck","cordova/exec":"cordova/exec"}],"cordova-plugin-file.resolveLocalFileSystemURI":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/
(function () {
    // For browser platform: not all browsers use overrided `resolveLocalFileSystemURL`.
    function checkBrowser () {
        if (cordova.platformId === 'browser' && require('cordova-plugin-file.isChrome')()) { // eslint-disable-line no-undef
            module.exports.resolveLocalFileSystemURL = window.resolveLocalFileSystemURL || window.webkitResolveLocalFileSystemURL;
            return true;
        }
        return false;
    }
    if (checkBrowser()) {
        return;
    }

    var argscheck = require('cordova/argscheck');
    var DirectoryEntry = require('cordova-plugin-file.DirectoryEntry');
    var FileEntry = require('cordova-plugin-file.FileEntry');
    var FileError = require('cordova-plugin-file.FileError');
    var exec = require('cordova/exec');
    var fileSystems = require('cordova-plugin-file.fileSystems');

    /**
     * Look up file system Entry referred to by local URI.
     * @param {DOMString} uri  URI referring to a local file or directory
     * @param successCallback  invoked with Entry object corresponding to URI
     * @param errorCallback    invoked if error occurs retrieving file system entry
     */
    module.exports.resolveLocalFileSystemURL = module.exports.resolveLocalFileSystemURL || function (uri, successCallback, errorCallback) {
        argscheck.checkArgs('sFF', 'resolveLocalFileSystemURI', arguments);
        // error callback
        var fail = function (error) {
            if (errorCallback) {
                errorCallback(new FileError(error));
            }
        };
        // sanity check for 'not:valid:filename' or '/not:valid:filename'
        // file.spec.12 window.resolveLocalFileSystemURI should error (ENCODING_ERR) when resolving invalid URI with leading /.
        if (!uri || uri.split(':').length > 2) {
            setTimeout(function () {
                fail(FileError.ENCODING_ERR);
            }, 0);
            return;
        }
        // if successful, return either a file or directory entry
        var success = function (entry) {
            if (entry) {
                if (successCallback) {
                    // create appropriate Entry object
                    var fsName = entry.filesystemName || (entry.filesystem && entry.filesystem.name) || (entry.filesystem === window.PERSISTENT ? 'persistent' : 'temporary'); // eslint-disable-line no-undef
                    fileSystems.getFs(fsName, function (fs) {
                        // This should happen only on platforms that haven't implemented requestAllFileSystems (windows)
                        if (!fs) {
                            fs = new FileSystem(fsName, {name: '', fullPath: '/'}); // eslint-disable-line no-undef
                        }
                        var result = (entry.isDirectory) ? new DirectoryEntry(entry.name, entry.fullPath, fs, entry.nativeURL) : new FileEntry(entry.name, entry.fullPath, fs, entry.nativeURL);
                        successCallback(result);
                    });
                }
            } else {
                // no Entry object returned
                fail(FileError.NOT_FOUND_ERR);
            }
        };

        exec(success, fail, 'File', 'resolveLocalFileSystemURI', [uri]);
    };

    module.exports.resolveLocalFileSystemURI = function () {
        console.log('resolveLocalFileSystemURI is deprecated. Please call resolveLocalFileSystemURL instead.');
        module.exports.resolveLocalFileSystemURL.apply(this, arguments);
    };
})();

},{"cordova-plugin-file.DirectoryEntry":"cordova-plugin-file.DirectoryEntry","cordova-plugin-file.FileEntry":"cordova-plugin-file.FileEntry","cordova-plugin-file.FileError":"cordova-plugin-file.FileError","cordova-plugin-file.fileSystems":"cordova-plugin-file.fileSystems","cordova-plugin-file.isChrome":"cordova-plugin-file.isChrome","cordova/argscheck":"cordova/argscheck","cordova/exec":"cordova/exec"}],"cordova/argscheck":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var utils = require('cordova/utils');

var moduleExports = module.exports;

var typeMap = {
    'A': 'Array',
    'D': 'Date',
    'N': 'Number',
    'S': 'String',
    'F': 'Function',
    'O': 'Object'
};

function extractParamName (callee, argIndex) {
    return (/.*?\((.*?)\)/).exec(callee)[1].split(', ')[argIndex];
}

function checkArgs (spec, functionName, args, opt_callee) {
    if (!moduleExports.enableChecks) {
        return;
    }
    var errMsg = null;
    var typeName;
    for (var i = 0; i < spec.length; ++i) {
        var c = spec.charAt(i);
        var cUpper = c.toUpperCase();
        var arg = args[i];
        // Asterix means allow anything.
        if (c === '*') {
            continue;
        }
        typeName = utils.typeName(arg);
        if ((arg === null || arg === undefined) && c === cUpper) {
            continue;
        }
        if (typeName !== typeMap[cUpper]) {
            errMsg = 'Expected ' + typeMap[cUpper];
            break;
        }
    }
    if (errMsg) {
        errMsg += ', but got ' + typeName + '.';
        errMsg = 'Wrong type for parameter "' + extractParamName(opt_callee || args.callee, i) + '" of ' + functionName + ': ' + errMsg;
        // Don't log when running unit tests.
        if (typeof jasmine === 'undefined') {
            console.error(errMsg);
        }
        throw TypeError(errMsg);
    }
}

function getValue (value, defaultValue) {
    return value === undefined ? defaultValue : value;
}

moduleExports.checkArgs = checkArgs;
moduleExports.getValue = getValue;
moduleExports.enableChecks = true;

},{"cordova/utils":"cordova/utils"}],"cordova/base64":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var base64 = exports;

base64.fromArrayBuffer = function (arrayBuffer) {
    var array = new Uint8Array(arrayBuffer);
    return uint8ToBase64(array);
};

base64.toArrayBuffer = function (str) {
    var decodedStr = typeof atob !== 'undefined' ? atob(str) : Buffer.from(str, 'base64').toString('binary'); // eslint-disable-line no-undef
    var arrayBuffer = new ArrayBuffer(decodedStr.length);
    var array = new Uint8Array(arrayBuffer);
    for (var i = 0, len = decodedStr.length; i < len; i++) {
        array[i] = decodedStr.charCodeAt(i);
    }
    return arrayBuffer;
};

// ------------------------------------------------------------------------------

/* This code is based on the performance tests at http://jsperf.com/b64tests
 * This 12-bit-at-a-time algorithm was the best performing version on all
 * platforms tested.
 */

var b64_6bit = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
var b64_12bit;

var b64_12bitTable = function () {
    b64_12bit = [];
    for (var i = 0; i < 64; i++) {
        for (var j = 0; j < 64; j++) {
            b64_12bit[i * 64 + j] = b64_6bit[i] + b64_6bit[j];
        }
    }
    b64_12bitTable = function () { return b64_12bit; };
    return b64_12bit;
};

function uint8ToBase64 (rawData) {
    var numBytes = rawData.byteLength;
    var output = '';
    var segment;
    var table = b64_12bitTable();
    for (var i = 0; i < numBytes - 2; i += 3) {
        segment = (rawData[i] << 16) + (rawData[i + 1] << 8) + rawData[i + 2];
        output += table[segment >> 12];
        output += table[segment & 0xfff];
    }
    if (numBytes - i === 2) {
        segment = (rawData[i] << 16) + (rawData[i + 1] << 8);
        output += table[segment >> 12];
        output += b64_6bit[(segment & 0xfff) >> 6];
        output += '=';
    } else if (numBytes - i === 1) {
        segment = (rawData[i] << 16);
        output += table[segment >> 12];
        output += '==';
    }
    return output;
}

},{}],"cordova/builder":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var utils = require('cordova/utils');

function each (objects, func, context) {
    for (var prop in objects) {
        if (objects.hasOwnProperty(prop)) {
            func.apply(context, [objects[prop], prop]);
        }
    }
}

function clobber (obj, key, value) {
    exports.replaceHookForTesting(obj, key);
    var needsProperty = false;
    try {
        obj[key] = value;
    } catch (e) {
        needsProperty = true;
    }
    // Getters can only be overridden by getters.
    if (needsProperty || obj[key] !== value) {
        utils.defineGetter(obj, key, function () {
            return value;
        });
    }
}

function assignOrWrapInDeprecateGetter (obj, key, value, message) {
    if (message) {
        utils.defineGetter(obj, key, function () {
            console.log(message);
            delete obj[key];
            clobber(obj, key, value);
            return value;
        });
    } else {
        clobber(obj, key, value);
    }
}

function include (parent, objects, clobber, merge) {
    each(objects, function (obj, key) {
        try {
            var result = obj.path ? require(obj.path) : {};

            if (clobber) {
                // Clobber if it doesn't exist.
                if (typeof parent[key] === 'undefined') {
                    assignOrWrapInDeprecateGetter(parent, key, result, obj.deprecated);
                } else if (typeof obj.path !== 'undefined') {
                    // If merging, merge properties onto parent, otherwise, clobber.
                    if (merge) {
                        recursiveMerge(parent[key], result);
                    } else {
                        assignOrWrapInDeprecateGetter(parent, key, result, obj.deprecated);
                    }
                }
                result = parent[key];
            } else {
                // Overwrite if not currently defined.
                if (typeof parent[key] === 'undefined') {
                    assignOrWrapInDeprecateGetter(parent, key, result, obj.deprecated);
                } else {
                    // Set result to what already exists, so we can build children into it if they exist.
                    result = parent[key];
                }
            }

            if (obj.children) {
                include(result, obj.children, clobber, merge);
            }
        } catch (e) {
            utils.alert('Exception building Cordova JS globals: ' + e + ' for key "' + key + '"');
        }
    });
}

/**
 * Merge properties from one object onto another recursively.  Properties from
 * the src object will overwrite existing target property.
 *
 * @param target Object to merge properties into.
 * @param src Object to merge properties from.
 */
function recursiveMerge (target, src) {
    for (var prop in src) {
        if (src.hasOwnProperty(prop)) {
            if (target.prototype && target.prototype.constructor === target) {
                // If the target object is a constructor override off prototype.
                clobber(target.prototype, prop, src[prop]);
            } else {
                if (typeof src[prop] === 'object' && typeof target[prop] === 'object') {
                    recursiveMerge(target[prop], src[prop]);
                } else {
                    clobber(target, prop, src[prop]);
                }
            }
        }
    }
}

exports.buildIntoButDoNotClobber = function (objects, target) {
    include(target, objects, false, false);
};
exports.buildIntoAndClobber = function (objects, target) {
    include(target, objects, true, false);
};
exports.buildIntoAndMerge = function (objects, target) {
    include(target, objects, true, true);
};
exports.recursiveMerge = recursiveMerge;
exports.assignOrWrapInDeprecateGetter = assignOrWrapInDeprecateGetter;
exports.replaceHookForTesting = function () {};

},{"cordova/utils":"cordova/utils"}],"cordova/channel":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var utils = require('cordova/utils');
var nextGuid = 1;

/**
 * Custom pub-sub "channel" that can have functions subscribed to it
 * This object is used to define and control firing of events for
 * cordova initialization, as well as for custom events thereafter.
 *
 * The order of events during page load and Cordova startup is as follows:
 *
 * onDOMContentLoaded*         Internal event that is received when the web page is loaded and parsed.
 * onNativeReady*              Internal event that indicates the Cordova native side is ready.
 * onCordovaReady*             Internal event fired when all Cordova JavaScript objects have been created.
 * onDeviceReady*              User event fired to indicate that Cordova is ready
 * onResume                    User event fired to indicate a start/resume lifecycle event
 * onPause                     User event fired to indicate a pause lifecycle event
 *
 * The events marked with an * are sticky. Once they have fired, they will stay in the fired state.
 * All listeners that subscribe after the event is fired will be executed right away.
 *
 * The only Cordova events that user code should register for are:
 *      deviceready           Cordova native code is initialized and Cordova APIs can be called from JavaScript
 *      pause                 App has moved to background
 *      resume                App has returned to foreground
 *
 * Listeners can be registered as:
 *      document.addEventListener("deviceready", myDeviceReadyListener, false);
 *      document.addEventListener("resume", myResumeListener, false);
 *      document.addEventListener("pause", myPauseListener, false);
 *
 * The DOM lifecycle events should be used for saving and restoring state
 *      window.onload
 *      window.onunload
 *
 */

/**
 * Channel
 * @constructor
 * @param type  String the channel name
 */
var Channel = function (type, sticky) {
    this.type = type;
    // Map of guid -> function.
    this.handlers = {};
    // 0 = Non-sticky, 1 = Sticky non-fired, 2 = Sticky fired.
    this.state = sticky ? 1 : 0;
    // Used in sticky mode to remember args passed to fire().
    this.fireArgs = null;
    // Used by onHasSubscribersChange to know if there are any listeners.
    this.numHandlers = 0;
    // Function that is called when the first listener is subscribed, or when
    // the last listener is unsubscribed.
    this.onHasSubscribersChange = null;
};
var channel = {
    /**
     * Calls the provided function only after all of the channels specified
     * have been fired. All channels must be sticky channels.
     */
    join: function (h, c) {
        var len = c.length;
        var i = len;
        var f = function () {
            if (!(--i)) h();
        };
        for (var j = 0; j < len; j++) {
            if (c[j].state === 0) {
                throw Error('Can only use join with sticky channels.');
            }
            c[j].subscribe(f);
        }
        if (!len) h();
    },
    /* eslint-disable no-return-assign */
    create: function (type) {
        return channel[type] = new Channel(type, false);
    },
    createSticky: function (type) {
        return channel[type] = new Channel(type, true);
    },
    /* eslint-enable no-return-assign */
    /**
     * cordova Channels that must fire before "deviceready" is fired.
     */
    deviceReadyChannelsArray: [],
    deviceReadyChannelsMap: {},

    /**
     * Indicate that a feature needs to be initialized before it is ready to be used.
     * This holds up Cordova's "deviceready" event until the feature has been initialized
     * and Cordova.initComplete(feature) is called.
     *
     * @param feature {String}     The unique feature name
     */
    waitForInitialization: function (feature) {
        if (feature) {
            var c = channel[feature] || this.createSticky(feature);
            this.deviceReadyChannelsMap[feature] = c;
            this.deviceReadyChannelsArray.push(c);
        }
    },

    /**
     * Indicate that initialization code has completed and the feature is ready to be used.
     *
     * @param feature {String}     The unique feature name
     */
    initializationComplete: function (feature) {
        var c = this.deviceReadyChannelsMap[feature];
        if (c) {
            c.fire();
        }
    }
};

function checkSubscriptionArgument (argument) {
    if (typeof argument !== 'function' && typeof argument.handleEvent !== 'function') {
        throw new Error(
            'Must provide a function or an EventListener object ' +
                'implementing the handleEvent interface.'
        );
    }
}

/**
 * Subscribes the given function to the channel. Any time that
 * Channel.fire is called so too will the function.
 * Optionally specify an execution context for the function
 * and a guid that can be used to stop subscribing to the channel.
 * Returns the guid.
 */
Channel.prototype.subscribe = function (eventListenerOrFunction, eventListener) {
    checkSubscriptionArgument(eventListenerOrFunction);
    var handleEvent, guid;

    if (eventListenerOrFunction && typeof eventListenerOrFunction === 'object') {
        // Received an EventListener object implementing the handleEvent interface
        handleEvent = eventListenerOrFunction.handleEvent;
        eventListener = eventListenerOrFunction;
    } else {
        // Received a function to handle event
        handleEvent = eventListenerOrFunction;
    }

    if (this.state === 2) {
        handleEvent.apply(eventListener || this, this.fireArgs);
        return;
    }

    guid = eventListenerOrFunction.observer_guid;
    if (typeof eventListener === 'object') {
        handleEvent = utils.close(eventListener, handleEvent);
    }

    if (!guid) {
        // First time any channel has seen this subscriber
        guid = '' + nextGuid++;
    }
    handleEvent.observer_guid = guid;
    eventListenerOrFunction.observer_guid = guid;

    // Don't add the same handler more than once.
    if (!this.handlers[guid]) {
        this.handlers[guid] = handleEvent;
        this.numHandlers++;
        if (this.numHandlers === 1) {
            this.onHasSubscribersChange && this.onHasSubscribersChange();
        }
    }
};

/**
 * Unsubscribes the function with the given guid from the channel.
 */
Channel.prototype.unsubscribe = function (eventListenerOrFunction) {
    checkSubscriptionArgument(eventListenerOrFunction);
    var handleEvent, guid, handler;

    if (eventListenerOrFunction && typeof eventListenerOrFunction === 'object') {
        // Received an EventListener object implementing the handleEvent interface
        handleEvent = eventListenerOrFunction.handleEvent;
    } else {
        // Received a function to handle event
        handleEvent = eventListenerOrFunction;
    }

    guid = handleEvent.observer_guid;
    handler = this.handlers[guid];
    if (handler) {
        delete this.handlers[guid];
        this.numHandlers--;
        if (this.numHandlers === 0) {
            this.onHasSubscribersChange && this.onHasSubscribersChange();
        }
    }
};

/**
 * Calls all functions subscribed to this channel.
 */
Channel.prototype.fire = function (e) {
    var fail = false; // eslint-disable-line no-unused-vars
    var fireArgs = Array.prototype.slice.call(arguments);
    // Apply stickiness.
    if (this.state === 1) {
        this.state = 2;
        this.fireArgs = fireArgs;
    }
    if (this.numHandlers) {
        // Copy the values first so that it is safe to modify it from within
        // callbacks.
        var toCall = [];
        for (var item in this.handlers) {
            toCall.push(this.handlers[item]);
        }
        for (var i = 0; i < toCall.length; ++i) {
            toCall[i].apply(this, fireArgs);
        }
        if (this.state === 2 && this.numHandlers) {
            this.numHandlers = 0;
            this.handlers = {};
            this.onHasSubscribersChange && this.onHasSubscribersChange();
        }
    }
};

// defining them here so they are ready super fast!
// DOM event that is received when the web page is loaded and parsed.
channel.createSticky('onDOMContentLoaded');

// Event to indicate the Cordova native side is ready.
channel.createSticky('onNativeReady');

// Event to indicate that all Cordova JavaScript objects have been created
// and it's time to run plugin constructors.
channel.createSticky('onCordovaReady');

// Event to indicate that all automatically loaded JS plugins are loaded and ready.
// FIXME remove this
channel.createSticky('onPluginsReady');

// Event to indicate that Cordova is ready
channel.createSticky('onDeviceReady');

// Event to indicate a resume lifecycle event
channel.create('onResume');

// Event to indicate a pause lifecycle event
channel.create('onPause');

// Channels that must fire before "deviceready" is fired.
channel.waitForInitialization('onCordovaReady');
channel.waitForInitialization('onDOMContentLoaded');

module.exports = channel;

},{"cordova/utils":"cordova/utils"}],"cordova/confighelper":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var config;

function Config(xhr) {
    function loadPreferences(xhr) {
       var parser = new DOMParser();
       var doc = parser.parseFromString(xhr.responseText, "application/xml");

       var preferences = doc.getElementsByTagName("preference");
       return Array.prototype.slice.call(preferences);
    }

    this.xhr = xhr;
    this.preferences = loadPreferences(this.xhr);
}

function readConfig(success, error) {
    var xhr;

    if(typeof config != 'undefined') {
        success(config);
    }

    function fail(msg) {
        console.error(msg);

        if(error) {
            error(msg);
        }
    }

    var xhrStatusChangeHandler = function() {
        if (xhr.readyState == 4) {
            if (xhr.status == 200 || xhr.status == 304 || xhr.status === 0 /* file:// */) {
                config = new Config(xhr);
                success(config);
            }
            else {
                fail('[Browser][cordova.js][xhrStatusChangeHandler] Could not XHR config.xml: ' + xhr.statusText);
            }
        }
    };

    xhr = new XMLHttpRequest();
    xhr.addEventListener("load", xhrStatusChangeHandler);


    try {
        xhr.open("get", "/config.xml", true);
        xhr.send();
    } catch(e) {
        fail('[Browser][cordova.js][readConfig] Could not XHR config.xml: ' + JSON.stringify(e));
    }
}

/**
 * Reads a preference value from config.xml.
 * Returns preference value or undefined if it does not exist.
 * @param {String} preferenceName Preference name to read */
Config.prototype.getPreferenceValue = function getPreferenceValue(preferenceName) {
    var preferenceItem = this.preferences && this.preferences.filter(function(item) {
        return item.attributes.name && item.attributes.name.value === preferenceName;
    });

    if(preferenceItem && preferenceItem[0] && preferenceItem[0].attributes && preferenceItem[0].attributes.value) {
        return preferenceItem[0].attributes.value.value;
    }
};

exports.readConfig = readConfig;

},{}],"cordova/exec/proxy":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

// internal map of proxy function
var CommandProxyMap = {};

module.exports = {

    // example: cordova.commandProxy.add("Accelerometer",{getCurrentAcceleration: function(successCallback, errorCallback, options) {...},...);
    add: function (id, proxyObj) {
        console.log('adding proxy for ' + id);
        CommandProxyMap[id] = proxyObj;
        return proxyObj;
    },

    // cordova.commandProxy.remove("Accelerometer");
    remove: function (id) {
        var proxy = CommandProxyMap[id];
        delete CommandProxyMap[id];
        CommandProxyMap[id] = null;
        return proxy;
    },

    get: function (service, action) {
        return (CommandProxyMap[service] ? CommandProxyMap[service][action] : null);
    }
};

},{}],"cordova/exec":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/*jslint sloppy:true, plusplus:true*/
/*global require, module, console */

var cordova = require('cordova');
var execProxy = require('cordova/exec/proxy');

/**
 * Execute a cordova command.  It is up to the native side whether this action
 * is synchronous or asynchronous.  The native side can return:
 *      Synchronous: PluginResult object as a JSON string
 *      Asynchronous: Empty string ""
 * If async, the native side will cordova.callbackSuccess or cordova.callbackError,
 * depending upon the result of the action.
 *
 * @param {Function} success    The success callback
 * @param {Function} fail       The fail callback
 * @param {String} service      The name of the service to use
 * @param {String} action       Action to be run in cordova
 * @param {String[]} [args]     Zero or more arguments to pass to the method
 */
module.exports = function (success, fail, service, action, args) {

    var proxy = execProxy.get(service, action);

    args = args || [];

    if (proxy) {
        
        var callbackId = service + cordova.callbackId++;
        
        if (typeof success === "function" || typeof fail === "function") {
            cordova.callbacks[callbackId] = {success: success, fail: fail};
        }
        try {

            

            // callbackOptions param represents additional optional parameters command could pass back, like keepCallback or
            // custom callbackId, for example {callbackId: id, keepCallback: true, status: cordova.callbackStatus.JSON_EXCEPTION }
            var onSuccess = function (result, callbackOptions) {
                callbackOptions = callbackOptions || {};
                var callbackStatus;
                // covering both undefined and null.
                // strict null comparison was causing callbackStatus to be undefined
                // and then no callback was called because of the check in cordova.callbackFromNative
                // see CB-8996 Mobilespec app hang on windows
                if (callbackOptions.status !== undefined && callbackOptions.status !== null) {
                    callbackStatus = callbackOptions.status;
                }
                else {
                    callbackStatus = cordova.callbackStatus.OK;
                }
                cordova.callbackSuccess(callbackOptions.callbackId || callbackId,
                    {
                        status: callbackStatus,
                        message: result,
                        keepCallback: callbackOptions.keepCallback || false
                    });
            };
            var onError = function (err, callbackOptions) {
                callbackOptions = callbackOptions || {};
                var callbackStatus;
                // covering both undefined and null.
                // strict null comparison was causing callbackStatus to be undefined
                // and then no callback was called because of the check in cordova.callbackFromNative
                // note: status can be 0
                if (callbackOptions.status !== undefined && callbackOptions.status !== null) {
                    callbackStatus = callbackOptions.status;
                }
                else {
                    callbackStatus = cordova.callbackStatus.OK;
                }
                cordova.callbackError(callbackOptions.callbackId || callbackId,
                {
                    status: callbackStatus,
                    message: err,
                    keepCallback: callbackOptions.keepCallback || false
                });
            };
            proxy(onSuccess, onError, args);

        } catch (e) {
            console.log("Exception calling native with command :: " + service + " :: " + action  + " ::exception=" + e);
        }
    } else {

        console.log("Error: exec proxy not found for :: " + service + " :: " + action);
        
        if(typeof fail === "function" ) {
            fail("Missing Command Error");
        }
    }
};

},{"cordova":"cordova","cordova/exec/proxy":"cordova/exec/proxy"}],"cordova/init":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var channel = require('cordova/channel');
var cordova = require('cordova');
var modulemapper = require('cordova/modulemapper');
var platform = require('cordova/platform');
var pluginloader = require('cordova/pluginloader');
var utils = require('cordova/utils');

var platformInitChannelsArray = [channel.onDOMContentLoaded, channel.onNativeReady, channel.onPluginsReady];

// setting exec
cordova.exec = require('cordova/exec');

function logUnfiredChannels (arr) {
    for (var i = 0; i < arr.length; ++i) {
        if (arr[i].state !== 2) {
            console.log('Channel not fired: ' + arr[i].type);
        }
    }
}

window.setTimeout(function () {
    if (channel.onDeviceReady.state !== 2) {
        console.log('deviceready has not fired after 5 seconds.');
        logUnfiredChannels(platformInitChannelsArray);
        logUnfiredChannels(channel.deviceReadyChannelsArray);
    }
}, 5000);

// Replace navigator before any modules are required(), to ensure it happens as soon as possible.
// We replace it so that properties that can't be clobbered can instead be overridden.
function replaceNavigator (origNavigator) {
    var CordovaNavigator = function () {};
    CordovaNavigator.prototype = origNavigator;
    var newNavigator = new CordovaNavigator();
    // This work-around really only applies to new APIs that are newer than Function.bind.
    // Without it, APIs such as getGamepads() break.
    if (CordovaNavigator.bind) {
        for (var key in origNavigator) {
            if (typeof origNavigator[key] === 'function') {
                newNavigator[key] = origNavigator[key].bind(origNavigator);
            } else {
                (function (k) {
                    utils.defineGetterSetter(newNavigator, key, function () {
                        return origNavigator[k];
                    });
                })(key);
            }
        }
    }
    return newNavigator;
}
if (window.navigator) {
    window.navigator = replaceNavigator(window.navigator);
}

if (!window.console) {
    window.console = {
        log: function () {}
    };
}
if (!window.console.warn) {
    window.console.warn = function (msg) {
        this.log('warn: ' + msg);
    };
}

// Register pause, resume and deviceready channels as events on document.
channel.onPause = cordova.addDocumentEventHandler('pause');
channel.onResume = cordova.addDocumentEventHandler('resume');
channel.onActivated = cordova.addDocumentEventHandler('activated');
channel.onDeviceReady = cordova.addStickyDocumentEventHandler('deviceready');

// Listen for DOMContentLoaded and notify our channel subscribers.
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    channel.onDOMContentLoaded.fire();
} else {
    document.addEventListener('DOMContentLoaded', function () {
        channel.onDOMContentLoaded.fire();
    }, false);
}

// _nativeReady is global variable that the native side can set
// to signify that the native code is ready. It is a global since
// it may be called before any cordova JS is ready.
if (window._nativeReady) {
    channel.onNativeReady.fire();
}

// Call the platform-specific initialization.
platform.bootstrap && platform.bootstrap();

// Wrap in a setTimeout to support the use-case of having plugin JS appended to cordova.js.
// The delay allows the attached modules to be defined before the plugin loader looks for them.
setTimeout(function () {
    pluginloader.load(function () {
        channel.onPluginsReady.fire();
    });
}, 0);

/**
 * Create all cordova objects once native side is ready.
 */
channel.join(function () {
    modulemapper.mapModules(window);

    platform.initialize && platform.initialize();

    // Fire event to notify that all objects are created
    channel.onCordovaReady.fire();

    // Fire onDeviceReady event once page has fully loaded, all
    // constructors have run and cordova info has been received from native
    // side.
    channel.join(function () {
        require('cordova').fireDocumentEvent('deviceready');
    }, channel.deviceReadyChannelsArray);

}, platformInitChannelsArray);

},{"cordova":"cordova","cordova/channel":"cordova/channel","cordova/exec":"cordova/exec","cordova/modulemapper":"cordova/modulemapper","cordova/platform":"cordova/platform","cordova/pluginloader":"cordova/pluginloader","cordova/utils":"cordova/utils"}],"cordova/modulemapper":[function(require,module,exports){
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var builder = require('cordova/builder');
var symbolList = [];
var deprecationMap;

exports.reset = function () {
    symbolList = [];
    deprecationMap = {};
};

function addEntry (strategy, moduleName, symbolPath, opt_deprecationMessage) {
    symbolList.push(strategy, moduleName, symbolPath);
    if (opt_deprecationMessage) {
        deprecationMap[symbolPath] = opt_deprecationMessage;
    }
}

// Note: Android 2.3 does have Function.bind().
exports.clobbers = function (moduleName, symbolPath, opt_deprecationMessage) {
    addEntry('c', moduleName, symbolPath, opt_deprecationMessage);
};

exports.merges = function (moduleName, symbolPath, opt_deprecationMessage) {
    addEntry('m', moduleName, symbolPath, opt_deprecationMessage);
};

exports.defaults = function (moduleName, symbolPath, opt_deprecationMessage) {
    addEntry('d', moduleName, symbolPath, opt_deprecationMessage);
};

exports.runs = function (moduleName) {
    addEntry('r', moduleName, null);
};

function prepareNamespace (symbolPath, context) {
    if (!symbolPath) {
        return context;
    }
    var parts = symbolPath.split('.');
    var cur = context;
    for (var i = 0, part; part = parts[i]; ++i) { // eslint-disable-line no-cond-assign
        cur = cur[part] = cur[part] || {};
    }
    return cur;
}

exports.mapModules = function (context) {
    var origSymbols = {};
    context.CDV_origSymbols = origSymbols;
    for (var i = 0, len = symbolList.length; i < len; i += 3) {
        var strategy = symbolList[i];
        var moduleName = symbolList[i + 1];
        var module = require(moduleName);
        // <runs/>
        if (strategy === 'r') {
            continue;
        }
        var symbolPath = symbolList[i + 2];
        var lastDot = symbolPath.lastIndexOf('.');
        var namespace = symbolPath.substr(0, lastDot);
        var lastName = symbolPath.substr(lastDot + 1);

        var deprecationMsg = symbolPath in deprecationMap ? 'Access made to deprecated symbol: ' + symbolPath + '. ' + deprecationMsg : null;
        var parentObj = prepareNamespace(namespace, context);
        var target = parentObj[lastName];

        if (strategy === 'm' && target) {
            builder.recursiveMerge(target, module);
        } else if ((strategy === 'd' && !target) || (strategy !== 'd')) {
            if (!(symbolPath in origSymbols)) {
                origSymbols[symbolPath] = target;
            }
            builder.assignOrWrapInDeprecateGetter(parentObj, lastName, module, deprecationMsg);
        }
    }
};

exports.getOriginalSymbol = function (context, symbolPath) {
    var origSymbols = context.CDV_origSymbols;
    if (origSymbols && (symbolPath in origSymbols)) {
        return origSymbols[symbolPath];
    }
    var parts = symbolPath.split('.');
    var obj = context;
    for (var i = 0; i < parts.length; ++i) {
        obj = obj && obj[parts[i]];
    }
    return obj;
};

exports.reset();

},{"cordova/builder":"cordova/builder"}],"cordova/platform":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

module.exports = {
    id: 'browser',
    cordovaVersion: '4.2.0', // cordova-js

    bootstrap: function() {

        var modulemapper = require('cordova/modulemapper');
        var channel = require('cordova/channel');

        modulemapper.clobbers('cordova/exec/proxy', 'cordova.commandProxy');

        channel.onNativeReady.fire();

        document.addEventListener("visibilitychange", function(){
            if(document.hidden) {
                channel.onPause.fire();
            }
            else {
                channel.onResume.fire();
            }
        });

    // End of bootstrap
    }
};

},{"cordova/channel":"cordova/channel","cordova/modulemapper":"cordova/modulemapper"}],"cordova/plugin_list":[function(require,module,exports){
module.exports = [
  {
    "file": "www/FileTransferError.js",
    "id": "cordova-plugin-file-transfer.FileTransferError",
    "name": "FileTransferError",
    "pluginId": "cordova-plugin-file-transfer",
    "clobbers": [
      "window.FileTransferError"
    ]
  },
  {
    "file": "www/FileTransfer.js",
    "id": "cordova-plugin-file-transfer.FileTransfer",
    "name": "FileTransfer",
    "pluginId": "cordova-plugin-file-transfer",
    "clobbers": [
      "window.FileTransfer"
    ]
  },
  {
    "file": "www/browser/FileTransfer.js",
    "id": "cordova-plugin-file-transfer.BrowserFileTransfer",
    "name": "BrowserFileTransfer",
    "pluginId": "cordova-plugin-file-transfer",
    "clobbers": [
      "window.FileTransfer"
    ]
  },
  {
    "file": "www/DirectoryEntry.js",
    "id": "cordova-plugin-file.DirectoryEntry",
    "name": "DirectoryEntry",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.DirectoryEntry"
    ]
  },
  {
    "file": "www/DirectoryReader.js",
    "id": "cordova-plugin-file.DirectoryReader",
    "name": "DirectoryReader",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.DirectoryReader"
    ]
  },
  {
    "file": "www/Entry.js",
    "id": "cordova-plugin-file.Entry",
    "name": "Entry",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.Entry"
    ]
  },
  {
    "file": "www/File.js",
    "id": "cordova-plugin-file.File",
    "name": "File",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.File"
    ]
  },
  {
    "file": "www/FileEntry.js",
    "id": "cordova-plugin-file.FileEntry",
    "name": "FileEntry",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.FileEntry"
    ]
  },
  {
    "file": "www/FileError.js",
    "id": "cordova-plugin-file.FileError",
    "name": "FileError",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.FileError"
    ]
  },
  {
    "file": "www/FileReader.js",
    "id": "cordova-plugin-file.FileReader",
    "name": "FileReader",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.FileReader"
    ]
  },
  {
    "file": "www/FileSystem.js",
    "id": "cordova-plugin-file.FileSystem",
    "name": "FileSystem",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.FileSystem"
    ]
  },
  {
    "file": "www/FileUploadOptions.js",
    "id": "cordova-plugin-file.FileUploadOptions",
    "name": "FileUploadOptions",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.FileUploadOptions"
    ]
  },
  {
    "file": "www/FileUploadResult.js",
    "id": "cordova-plugin-file.FileUploadResult",
    "name": "FileUploadResult",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.FileUploadResult"
    ]
  },
  {
    "file": "www/FileWriter.js",
    "id": "cordova-plugin-file.FileWriter",
    "name": "FileWriter",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.FileWriter"
    ]
  },
  {
    "file": "www/Flags.js",
    "id": "cordova-plugin-file.Flags",
    "name": "Flags",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.Flags"
    ]
  },
  {
    "file": "www/LocalFileSystem.js",
    "id": "cordova-plugin-file.LocalFileSystem",
    "name": "LocalFileSystem",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.LocalFileSystem"
    ],
    "merges": [
      "window"
    ]
  },
  {
    "file": "www/Metadata.js",
    "id": "cordova-plugin-file.Metadata",
    "name": "Metadata",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.Metadata"
    ]
  },
  {
    "file": "www/ProgressEvent.js",
    "id": "cordova-plugin-file.ProgressEvent",
    "name": "ProgressEvent",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.ProgressEvent"
    ]
  },
  {
    "file": "www/fileSystems.js",
    "id": "cordova-plugin-file.fileSystems",
    "name": "fileSystems",
    "pluginId": "cordova-plugin-file"
  },
  {
    "file": "www/requestFileSystem.js",
    "id": "cordova-plugin-file.requestFileSystem",
    "name": "requestFileSystem",
    "pluginId": "cordova-plugin-file",
    "clobbers": [
      "window.requestFileSystem"
    ]
  },
  {
    "file": "www/resolveLocalFileSystemURI.js",
    "id": "cordova-plugin-file.resolveLocalFileSystemURI",
    "name": "resolveLocalFileSystemURI",
    "pluginId": "cordova-plugin-file",
    "merges": [
      "window"
    ]
  },
  {
    "file": "www/browser/isChrome.js",
    "id": "cordova-plugin-file.isChrome",
    "name": "isChrome",
    "pluginId": "cordova-plugin-file",
    "runs": true
  },
  {
    "file": "www/browser/Preparing.js",
    "id": "cordova-plugin-file.Preparing",
    "name": "Preparing",
    "pluginId": "cordova-plugin-file",
    "runs": true
  },
  {
    "file": "src/browser/FileProxy.js",
    "id": "cordova-plugin-file.browserFileProxy",
    "name": "browserFileProxy",
    "pluginId": "cordova-plugin-file",
    "runs": true
  },
  {
    "file": "www/fileSystemPaths.js",
    "id": "cordova-plugin-file.fileSystemPaths",
    "name": "fileSystemPaths",
    "pluginId": "cordova-plugin-file",
    "merges": [
      "cordova"
    ],
    "runs": true
  },
  {
    "file": "www/browser/FileSystem.js",
    "id": "cordova-plugin-file.firefoxFileSystem",
    "name": "firefoxFileSystem",
    "pluginId": "cordova-plugin-file",
    "merges": [
      "window.FileSystem"
    ]
  }
];
module.exports.metadata = {
  "cordova-plugin-whitelist": "1.3.3",
  "cordova-plugin-file-transfer": "1.7.0",
  "cordova-plugin-file": "5.0.0"
};

},{}],"cordova/pluginloader":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var modulemapper = require('cordova/modulemapper');

// Handler for the cordova_plugins.js content.
// See plugman's plugin_loader.js for the details of this object.
function handlePluginsObject (moduleList) {
    // if moduleList is not defined or empty, we've nothing to do
    if (!moduleList || !moduleList.length) {
        return;
    }

    // Loop through all the modules and then through their clobbers and merges.
    for (var i = 0, module; module = moduleList[i]; i++) { // eslint-disable-line no-cond-assign
        if (module.clobbers && module.clobbers.length) {
            for (var j = 0; j < module.clobbers.length; j++) {
                modulemapper.clobbers(module.id, module.clobbers[j]);
            }
        }

        if (module.merges && module.merges.length) {
            for (var k = 0; k < module.merges.length; k++) {
                modulemapper.merges(module.id, module.merges[k]);
            }
        }

        // Finally, if runs is truthy we want to simply require() the module.
        if (module.runs) {
            modulemapper.runs(module.id);
        }
    }
}

// Loads all plugins' js-modules. Plugin loading is syncronous in browserified bundle
// but the method accepts callback to be compatible with non-browserify flow.
// onDeviceReady is blocked on onPluginsReady. onPluginsReady is fired when there are
// no plugins to load, or they are all done.
exports.load = function (callback) {
    var moduleList = require('cordova/plugin_list');
    handlePluginsObject(moduleList);

    callback();
};

},{"cordova/modulemapper":"cordova/modulemapper","cordova/plugin_list":"cordova/plugin_list"}],"cordova/urlutil":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/**
 * For already absolute URLs, returns what is passed in.
 * For relative URLs, converts them to absolute ones.
 */
exports.makeAbsolute = function makeAbsolute (url) {
    var anchorEl = document.createElement('a');
    anchorEl.href = url;
    return anchorEl.href;
};

},{}],"cordova/utils":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var utils = exports;

/**
 * Defines a property getter / setter for obj[key].
 */
utils.defineGetterSetter = function (obj, key, getFunc, opt_setFunc) {
    if (Object.defineProperty) {
        var desc = {
            get: getFunc,
            configurable: true
        };
        if (opt_setFunc) {
            desc.set = opt_setFunc;
        }
        Object.defineProperty(obj, key, desc);
    } else {
        obj.__defineGetter__(key, getFunc);
        if (opt_setFunc) {
            obj.__defineSetter__(key, opt_setFunc);
        }
    }
};

/**
 * Defines a property getter for obj[key].
 */
utils.defineGetter = utils.defineGetterSetter;

utils.arrayIndexOf = function (a, item) {
    if (a.indexOf) {
        return a.indexOf(item);
    }
    var len = a.length;
    for (var i = 0; i < len; ++i) {
        if (a[i] === item) {
            return i;
        }
    }
    return -1;
};

/**
 * Returns whether the item was found in the array.
 */
utils.arrayRemove = function (a, item) {
    var index = utils.arrayIndexOf(a, item);
    if (index !== -1) {
        a.splice(index, 1);
    }
    return index !== -1;
};

utils.typeName = function (val) {
    return Object.prototype.toString.call(val).slice(8, -1);
};

/**
 * Returns an indication of whether the argument is an array or not
 */
utils.isArray = Array.isArray ||
                function (a) { return utils.typeName(a) === 'Array'; };

/**
 * Returns an indication of whether the argument is a Date or not
 */
utils.isDate = function (d) {
    return (d instanceof Date);
};

/**
 * Does a deep clone of the object.
 */
utils.clone = function (obj) {
    if (!obj || typeof obj === 'function' || utils.isDate(obj) || typeof obj !== 'object') {
        return obj;
    }

    var retVal, i;

    if (utils.isArray(obj)) {
        retVal = [];
        for (i = 0; i < obj.length; ++i) {
            retVal.push(utils.clone(obj[i]));
        }
        return retVal;
    }

    retVal = {};
    for (i in obj) {
        // https://issues.apache.org/jira/browse/CB-11522 'unknown' type may be returned in
        // custom protocol activation case on Windows Phone 8.1 causing "No such interface supported" exception
        // on cloning.
        if ((!(i in retVal) || retVal[i] !== obj[i]) && typeof obj[i] !== 'undefined' && typeof obj[i] !== 'unknown') { // eslint-disable-line valid-typeof
            retVal[i] = utils.clone(obj[i]);
        }
    }
    return retVal;
};

/**
 * Returns a wrapped version of the function
 */
utils.close = function (context, func, params) {
    return function () {
        var args = params || arguments;
        return func.apply(context, args);
    };
};

// ------------------------------------------------------------------------------
function UUIDcreatePart (length) {
    var uuidpart = '';
    for (var i = 0; i < length; i++) {
        var uuidchar = parseInt((Math.random() * 256), 10).toString(16);
        if (uuidchar.length === 1) {
            uuidchar = '0' + uuidchar;
        }
        uuidpart += uuidchar;
    }
    return uuidpart;
}

/**
 * Create a UUID
 */
utils.createUUID = function () {
    return UUIDcreatePart(4) + '-' +
        UUIDcreatePart(2) + '-' +
        UUIDcreatePart(2) + '-' +
        UUIDcreatePart(2) + '-' +
        UUIDcreatePart(6);
};

/**
 * Extends a child object from a parent object using classical inheritance
 * pattern.
 */
utils.extend = (function () {
    // proxy used to establish prototype chain
    var F = function () {};
    // extend Child from Parent
    return function (Child, Parent) {

        F.prototype = Parent.prototype;
        Child.prototype = new F();
        Child.__super__ = Parent.prototype;
        Child.prototype.constructor = Child;
    };
}());

/**
 * Alerts a message in any available way: alert or console.log.
 */
utils.alert = function (msg) {
    if (window.alert) {
        window.alert(msg);
    } else if (console && console.log) {
        console.log(msg);
    }
};

},{}],"cordova":[function(require,module,exports){
/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

// Workaround for Windows 10 in hosted environment case
// http://www.w3.org/html/wg/drafts/html/master/browsers.html#named-access-on-the-window-object
if (window.cordova && !(window.cordova instanceof HTMLElement)) { // eslint-disable-line no-undef
    throw new Error('cordova already defined');
}

var channel = require('cordova/channel');
var platform = require('cordova/platform');

/**
 * Intercept calls to addEventListener + removeEventListener and handle deviceready,
 * resume, and pause events.
 */
var m_document_addEventListener = document.addEventListener;
var m_document_removeEventListener = document.removeEventListener;
var m_window_addEventListener = window.addEventListener;
var m_window_removeEventListener = window.removeEventListener;

/**
 * Houses custom event handlers to intercept on document + window event listeners.
 */
var documentEventHandlers = {};
var windowEventHandlers = {};

document.addEventListener = function (evt, handler, capture) {
    var e = evt.toLowerCase();
    if (typeof documentEventHandlers[e] !== 'undefined') {
        documentEventHandlers[e].subscribe(handler);
    } else {
        m_document_addEventListener.call(document, evt, handler, capture);
    }
};

window.addEventListener = function (evt, handler, capture) {
    var e = evt.toLowerCase();
    if (typeof windowEventHandlers[e] !== 'undefined') {
        windowEventHandlers[e].subscribe(handler);
    } else {
        m_window_addEventListener.call(window, evt, handler, capture);
    }
};

document.removeEventListener = function (evt, handler, capture) {
    var e = evt.toLowerCase();
    // If unsubscribing from an event that is handled by a plugin
    if (typeof documentEventHandlers[e] !== 'undefined') {
        documentEventHandlers[e].unsubscribe(handler);
    } else {
        m_document_removeEventListener.call(document, evt, handler, capture);
    }
};

window.removeEventListener = function (evt, handler, capture) {
    var e = evt.toLowerCase();
    // If unsubscribing from an event that is handled by a plugin
    if (typeof windowEventHandlers[e] !== 'undefined') {
        windowEventHandlers[e].unsubscribe(handler);
    } else {
        m_window_removeEventListener.call(window, evt, handler, capture);
    }
};

function createEvent (type, data) {
    var event = document.createEvent('Events');
    event.initEvent(type, false, false);
    if (data) {
        for (var i in data) {
            if (data.hasOwnProperty(i)) {
                event[i] = data[i];
            }
        }
    }
    return event;
}

/* eslint-disable no-undef */
var cordova = {
    platformVersion: PLATFORM_VERSION_BUILD_LABEL,
    version: PLATFORM_VERSION_BUILD_LABEL,
    require: require,
    platformId: platform.id,

    /* eslint-enable no-undef */

    /**
     * Methods to add/remove your own addEventListener hijacking on document + window.
     */
    addWindowEventHandler: function (event) {
        return (windowEventHandlers[event] = channel.create(event));
    },
    addStickyDocumentEventHandler: function (event) {
        return (documentEventHandlers[event] = channel.createSticky(event));
    },
    addDocumentEventHandler: function (event) {
        return (documentEventHandlers[event] = channel.create(event));
    },
    removeWindowEventHandler: function (event) {
        delete windowEventHandlers[event];
    },
    removeDocumentEventHandler: function (event) {
        delete documentEventHandlers[event];
    },
    /**
     * Retrieve original event handlers that were replaced by Cordova
     *
     * @return object
     */
    getOriginalHandlers: function () {
        return {'document': {'addEventListener': m_document_addEventListener, 'removeEventListener': m_document_removeEventListener},
            'window': {'addEventListener': m_window_addEventListener, 'removeEventListener': m_window_removeEventListener}};
    },
    /**
     * Method to fire event from native code
     * bNoDetach is required for events which cause an exception which needs to be caught in native code
     */
    fireDocumentEvent: function (type, data, bNoDetach) {
        var evt = createEvent(type, data);
        if (typeof documentEventHandlers[type] !== 'undefined') {
            if (bNoDetach) {
                documentEventHandlers[type].fire(evt);
            } else {
                setTimeout(function () {
                    // Fire deviceready on listeners that were registered before cordova.js was loaded.
                    if (type === 'deviceready') {
                        document.dispatchEvent(evt);
                    }
                    documentEventHandlers[type].fire(evt);
                }, 0);
            }
        } else {
            document.dispatchEvent(evt);
        }
    },
    fireWindowEvent: function (type, data) {
        var evt = createEvent(type, data);
        if (typeof windowEventHandlers[type] !== 'undefined') {
            setTimeout(function () {
                windowEventHandlers[type].fire(evt);
            }, 0);
        } else {
            window.dispatchEvent(evt);
        }
    },

    /**
     * Plugin callback mechanism.
     */
    // Randomize the starting callbackId to avoid collisions after refreshing or navigating.
    // This way, it's very unlikely that any new callback would get the same callbackId as an old callback.
    callbackId: Math.floor(Math.random() * 2000000000),
    callbacks: {},
    callbackStatus: {
        NO_RESULT: 0,
        OK: 1,
        CLASS_NOT_FOUND_EXCEPTION: 2,
        ILLEGAL_ACCESS_EXCEPTION: 3,
        INSTANTIATION_EXCEPTION: 4,
        MALFORMED_URL_EXCEPTION: 5,
        IO_EXCEPTION: 6,
        INVALID_ACTION: 7,
        JSON_EXCEPTION: 8,
        ERROR: 9
    },
    /**
     * Called by native code when returning successful result from an action.
     */
    callbackSuccess: function (callbackId, args) {
        this.callbackFromNative(callbackId, true, args.status, [args.message], args.keepCallback);
    },
    /**
     * Called by native code when returning error result from an action.
     */
    callbackError: function (callbackId, args) {
        // TODO: Deprecate callbackSuccess and callbackError in favour of callbackFromNative.
        // Derive success from status.
        this.callbackFromNative(callbackId, false, args.status, [args.message], args.keepCallback);
    },
    /**
     * Called by native code when returning the result from an action.
     */
    callbackFromNative: function (callbackId, isSuccess, status, args, keepCallback) {
        try {
            var callback = cordova.callbacks[callbackId];
            if (callback) {
                if (isSuccess && status === cordova.callbackStatus.OK) {
                    callback.success && callback.success.apply(null, args);
                } else if (!isSuccess) {
                    callback.fail && callback.fail.apply(null, args);
                }
                /*
                else
                    Note, this case is intentionally not caught.
                    this can happen if isSuccess is true, but callbackStatus is NO_RESULT
                    which is used to remove a callback from the list without calling the callbacks
                    typically keepCallback is false in this case
                */

                // Clear callback if not expecting any more results
                if (!keepCallback) {
                    delete cordova.callbacks[callbackId];
                }
            }
        } catch (err) {
            var msg = 'Error in ' + (isSuccess ? 'Success' : 'Error') + ' callbackId: ' + callbackId + ' : ' + err;
            console && console.log && console.log(msg);
            this.fireWindowEvent('cordovacallbackerror', { 'message': msg });
            throw err;
        }
    },
    addConstructor: function (func) {
        channel.onCordovaReady.subscribe(function () {
            try {
                func();
            } catch (e) {
                console.log('Failed to run constructor: ' + e);
            }
        });
    }
};

window.cordova = module.exports = cordova;

},{"cordova/channel":"cordova/channel","cordova/platform":"cordova/platform"}]},{},["cordova/plugin_list",1]);
