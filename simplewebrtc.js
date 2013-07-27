var WebRTC = require('webrtc');
var WildEmitter = require('wildemitter');
var webrtcSupport = require('webrtcsupport');
var attachMediaStream = require('attachmediastream');
var getScreenMedia = require('getscreenmedia');

function dir(name, data) {
    console.log(name, data);
}

function sniff(func, self, name) {
    return function () {
        dir(name, arguments);
        return func.apply(self, arguments);
    }
}

function spyOn(connection) {
    var _on = connection.on;
    var _emit = connection.emit;
    var clientId = Math.random().toString(16)[2];

    connection.emit = function (name, data, cb) {
        dir(clientId + ': emit > ' + name, data);
        if (cb) {
            cb = sniff(cb, null, clientId + ': emit < ' + name);
        }
        return _emit.call(connection, name, data, cb);
    };

    connection.on = function (name, cb) {
        return _on.call(connection, name, sniff(cb, null, clientId + ': event < ' + name));
    };
}

function SimpleWebRTC(opts) {
    var self = this;
    var options = opts || {};
    var config = this.config = {
            url: 'http://signaling.simplewebrtc.com:8888',
            log: options.log,
            localVideoEl: '',
            remoteVideosEl: '',
            autoRequestMedia: false,
            autoRemoveVideos: true,
            adjustPeerVolume: true,
            peerVolumeWhenSpeaking: .25
        };
    var item, connection;

    // set options
    for (item in options) {
        this.config[item] = options[item];
    }

    // attach detected support for convenience
    this.capabilities = webrtcSupport;

    // call WildEmitter constructor
    WildEmitter.call(this);

    // our socket.io connection
    connection = this.connection = io.connect(this.config.url);

    spyOn(connection);

    connection.on('connect', function () {
        self.emit('ready', connection.socket.sessionid);
        self.sessionReady = true;
        self.testReadiness();
    });

    /**
     * message=
     * {
     *     from: 'client_id',
     *     to: 'client_id',
     *     prefix: 'webkit',
     *     type: 'offer' || 'candidate',
     *     payload: {}
     * }
     */
    connection.on('message', function (message) {
        var peers = self.webrtc.getPeers(message.from, message.roomType);
        var peer;

        if (message.type === 'offer') {
            self.emit('sendingOffer');
            peer = self.webrtc.createPeer({
                id: message.from,
                type: message.roomType,
                sharemyscreen: message.roomType === 'screen' && !message.broadcaster
            });
            peer.handleMessage(message);
        } else if (peers.length) {
            peers.forEach(function (peer) {
                peer.handleMessage(message);
            });
        }
    });

    /**
     * room =
     * {
     *     id: 'client_id',
     *     type: undefined || 'video' || 'audio' || 'screen'
     * }
     */
    connection.on('remove', function (room) {
        if (room.id !== self.connection.socket.sessionid) {
            self.webrtc.removePeers(room.id, room.type);
        }
    });

    // instantiate our main WebRTC helper
    this.webrtc = new WebRTC(opts);

    // attach a few methods from underlying lib to simple.
    ['mute', 'unmute', 'pause', 'resume'].forEach(function (method) {
        self[method] = self.webrtc[method].bind(self.webrtc);
    });

    // check for readiness
    this.webrtc.on('localStream', function () {
       self.testReadiness();
    });

    this.webrtc.on('message', function (payload) {
       self.connection.emit('message', payload);
    });

    this.webrtc.on('peerStreamAdded', this.handlePeerStreamAdded.bind(this));
    this.webrtc.on('peerStreamRemoved', this.handlePeerStreamRemoved.bind(this));

    // echo cancellation attempts
    if (this.config.adjustPeerVolume) {
        this.webrtc.on('speaking', this.setVolumeForAll.bind(this, this.config.peerVolumeWhenSpeaking));
        this.webrtc.on('stoppedSpeaking', this.setVolumeForAll.bind(this, 1));
    }

    if (this.config.autoRequestMedia) this.startLocalVideo();
}


SimpleWebRTC.prototype = Object.create(WildEmitter.prototype, {
    constructor: {
        value: SimpleWebRTC
    }
});

SimpleWebRTC.prototype.leaveRoom = function () {
    if (this.roomName) {
        this.connection.emit('leave', this.roomName);
        this.peers.forEach(function (peer) {
            peer.end();
        });
    }
};

SimpleWebRTC.prototype.handlePeerStreamAdded = function (peer) {
    var container = this.getRemoteVideoContainer();
    var video = attachMediaStream(peer.stream);

    // store video element as part of peer for easy removal
    peer.videoEl = video;
    video.id = this.getDomId(peer);

    if (container) container.appendChild(video);

    this.emit('videoAdded', video, peer);
};

SimpleWebRTC.prototype.handlePeerStreamRemoved = function (peer) {
    var container = this.getRemoteVideoContainer();
    var videoEl = peer.videoEl;
    if (this.config.autoRemoveVideos && container && videoEl) {
        container.removeChild(videoEl);
    }
    if (videoEl) this.emit('videoRemoved', videoEl, peer);
};

SimpleWebRTC.prototype.getDomId = function (peer) {
    return [peer.id, peer.type, peer.broadcaster ? 'broadcasting' : 'incoming'].join('_');
};

// set volume on video tag for all peers takse a value between 0 and 1
SimpleWebRTC.prototype.setVolumeForAll = function (volume) {
    this.webrtc.peers.forEach(function (peer) {
        if (peer.videoEl) peer.videoEl.volume = volume;
    });
};

SimpleWebRTC.prototype.joinRoom = function (name, cb) {
    cb = cb || function () {};
    var self = this;
    this.roomName = name;
    /**
     * roomDescription =
     * {
     *     clients: {
     *         'client_id': {
     *             audio: true,
     *             screen: true,
     *             video: false
     *         }
     *     }
     * }
     */
    this.connection.emit('join', name, function (err, roomDescription) {
        if (err) {
            self.emit('error', err);
            cb(err, roomDescription);
            return;
        }

        self.emit('join', name);
        var id,
            client,
            type,
            peer;

        for (id in roomDescription.clients) {
            client = roomDescription.clients[id];
            for (type in client) {
                if (client[type]) {
                    peer = self.webrtc.createPeer({
                        id: id,
                        type: type
                    });
                    peer.start();
                }
            }
        }

        cb(err, roomDescription);
    });
};

SimpleWebRTC.prototype.getEl = function (idOrEl) {
    if (typeof idOrEl === 'string') {
        return document.getElementById(idOrEl);
    } else {
        return idOrEl;
    }
};

SimpleWebRTC.prototype.startLocalVideo = function () {
    var self = this;
    this.webrtc.startLocalMedia(null, function (err, stream) {
        //console.log('starting local media', err, stream);
        if (err) {
            self.emit(err);
        } else {
            var videoElement = attachMediaStream(stream, self.getLocalVideoContainer(), {muted: true, mirror: true});

            videoElement.addEventListener('playing', function () {
                self.emit('localVideo');
            });
        }
    });
};

// this accepts either element ID or element
// and either the video tag itself or a container
// that will be used to put the video tag into.
SimpleWebRTC.prototype.getLocalVideoContainer = function () {
    var el = this.getEl(this.config.localVideoEl);
    if (el && el.tagName === 'VIDEO') {
        return el;
    } else if (el) {
        var video = document.createElement('video');
        el.appendChild(video);
        return video;
    }
};

SimpleWebRTC.prototype.getRemoteVideoContainer = function () {
    return this.getEl(this.config.remoteVideosEl);
};

SimpleWebRTC.prototype.shareScreen = function (cb) {
    cb = cb || function () {};
    var self = this;

    getScreenMedia(function (err, stream) {
        var item,
            el = document.createElement('video'),
            container = self.getRemoteVideoContainer();

        if (!err) {
            self.webrtc.localScreen = stream;
            el.id = 'localScreen';
            attachMediaStream(stream, el);
            if (container) {
                container.appendChild(el);
            }

            // TODO: Once this chrome bug is fixed:
            // https://code.google.com/p/chromium/issues/detail?id=227485
            // we need to listen for the screenshare stream ending and call
            // the "stopScreenShare" method to clean things up.

            self.emit('localScreenAdded', el);
            self.connection.emit('shareScreen');
            self.webrtc.peers.forEach(function (existingPeer) {
                var peer;
                if (existingPeer.type === 'video') {
                    peer = self.webrtc.createPeer({
                        id: existingPeer.id,
                        type: 'screen',
                        sharemyscreen: true,
                        broadcaster: self.connection.socket.sessionid
                    });
                    peer.start();
                }
            });
        } else {
            self.emit(err);
        }

        // enable the callback
        cb(err, stream);
    });
};

SimpleWebRTC.prototype.getLocalScreen = function () {
    return this.webrtc.localScreen;
};

SimpleWebRTC.prototype.stopScreenShare = function () {
    this.connection.emit('unshareScreen');
    var videoEl = document.getElementById('localScreen');
    var container = this.getRemoteVideoContainer();
    var stream = this.getLocalScreen();

    if (this.config.autoRemoveVideos && container && videoEl) {
        container.removeChild(videoEl);
    }

    // a hack to emit the event the removes the video
    // element that we want
    if (videoEl) this.emit('videoRemoved', videoEl);
    if (stream) stream.stop();
    this.webrtc.peers.forEach(function (peer) {
        if (peer.broadcaster) {
            peer.end();
        }
    });
    delete this.webrtc.localScreen;
};

SimpleWebRTC.prototype.testReadiness = function () {
    var self = this;
    if (this.webrtc.localStream && this.sessionReady) {
        // This timeout is a workaround for the strange no-audio bug
        // as described here: https://code.google.com/p/webrtc/issues/detail?id=1525
        // remove timeout when this is fixed.
        setTimeout(function () {
            self.emit('readyToCall', self.connection.socket.sessionid);
        }, 1000);
    }
};

SimpleWebRTC.prototype.createRoom = function (name, cb) {
    cb = cb || function () {};
    var self = this;

    this.connection.emit('create', name, function (data) {
        self.emit('create', name);
        cb(data);
    });
};

module.exports = SimpleWebRTC;
