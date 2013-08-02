$(function () {
    var reRoom = /^#?room\/([A-Za-z0-9\-_\.@]+)$/;

    // grab the room from the URL
    var room = (location.hash.match(reRoom) || 0)[1] || '';

    var $changeChannel = $('#changeChannel'),
        $status = $('#status'),
        $localVideo = $('#localVideo').hide();

    $changeChannel.click(function () {
        var name = prompt('Change room', room) || '';
        name = name.toLowerCase().replace(/\s/g, '-').replace(/[^A-Za-z0-9_\-\.]/g, '');

        if (name === room) {
            return false;
        }

        webrtc.leaveRoom();
        webrtc.joinRoom(name, function () {
            location.hash = 'room/' + name;
            room = name;
        });

        return false;
    });

    $status.text('offline');

    // create our webrtc connection
    var webrtc = new SimpleWebRTC({
        // the id/element dom element that will hold "our" video
        localVideoEl: 'localVideo',
        // the id/element dom element that will hold remote videos
        remoteVideosEl: 'remotes',
        // immediately ask for camera access
        autoRequestMedia: true,

        url: '/'
    });

    webrtc.on('readyToCall', function () {
        $localVideo.fadeIn();
    });

    webrtc.on('*', function (name, event) {
        $status.text(name);
    });

    webrtc.webrtc.on('*', function (name, event) {
        $status.text(name);
    });

    if (!room) {
        return;
    }

    // when it's ready, join if we got a room from the URL
    webrtc.on('readyToCall', function () {
        // you can name it anything
        webrtc.joinRoom(room);
    });

});