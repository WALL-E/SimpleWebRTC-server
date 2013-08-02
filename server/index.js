var fs = require('fs'),
    path = require('path'),
    express = require('express'),
    ip = require('ip'),
    os = require('os'),
    http = require('http'),
    socketIo = require('socket.io');

var host = '0.0.0.0',
    port = 8001;

var app = express();
app.use(express.static(path.join(__dirname, '..', 'www')));
app.use('/simplewebrtc', express.static(path.join(__dirname, '..', 'node_modules', 'simplewebrtc')));

var server = http.createServer(app),
    io = socketIo.listen(server);

var rooms = {};

io.sockets.on('connection', function (client) {
    /**
     * Returns or creates room descriptor
     * @param {String} channel channel/room name
     */
    function getRoom(channel) {
        return rooms[channel] = rooms[channel] || { clients: {} };
    }

    /**
     * Joins room
     * @param {String} channel channel/room name
     */
    function joinTo(channel) {
        if (client.channel === channel) {
            return;
        }
        var room = getRoom(channel);

        // add self
        room.clients[client.id] = {
            audio: false,
            screen: false,
            video: true
        };

        client.channel = channel;
    }

    /**
     * Leaves room
     * @param {String} [channel] channel/room name
     */
    function leave(channel) {
        channel = channel || client.channel;
        var room = getRoom(channel);

        // remove current client from room
        delete room.clients[client.id];

        // notify other peers but not self in current channel
        Object.keys(room.clients).forEach(function (client_id) {
            io.sockets.socket(client_id).emit('remove', {
                id: client.id
            });
        });

        // remove room if no clients
        if (!Object.keys(room).length) {
            delete rooms[channel];
        }
    }

    client.on('join', function (channel, fn) {
        // send list of other clients in that room
        fn(null, getRoom(channel));

        // then add self to that room
        joinTo(channel);
    });

    client.on('leave', leave);
    client.on('disconnect', leave);

    client.on('create', function (channel, fn) {
        // send channel name back
        fn(null, channel);

        // then add self to that room
        joinTo(channel);
    });

    // forward messages
    client.on('message', function (message) {
        message.from = client.id;
        io.sockets.socket(message.to).emit('message', message);
    });
});

console.log('Browse http://localhost:%s/#room/webrtc or http://%s:%s/#room/webrtc', port, ip.address(), port);
server.listen(port, host);
