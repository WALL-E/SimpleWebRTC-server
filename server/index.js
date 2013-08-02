var fs = require('fs'),
    path = require('path'),
    express = require('express'),
    os = require('os');

function remoteIp() {
    var interfaces = os.networkInterfaces(),
        ipv4 = [],
        ipv6 = [];

    Object.keys(interfaces).forEach(function (interfaceName) {
        interfaces[interfaceName].forEach(function (interfaceInfo) {
            if (!interfaceInfo.internal) {
                if (interfaceInfo.family === 'IPv4') {
                    ipv4.push(interfaceInfo.address);
                } else {
                    ipv6.push(interfaceInfo.address);
                }
            }
        });
    });

    return ipv4.concat(ipv6);
}

var app = express();
app.use(express.static(path.join(__dirname, 'www')));
app.use('/simplewebrtc', express.static(path.join(__dirname, 'node_modules', 'simplewebrtc')));

var server = require('http').createServer(app),
    io = require('socket.io').listen(server);

var rooms = {};

io.sockets.on('connection', function (client) {
    function getRoom(channel) {
        return rooms[channel] = rooms[channel] || { clients: {} };
    }

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
        // send others
        fn(null, getRoom(channel));

        // add self
        joinTo(channel);
    });

    client.on('leave', leave);
    client.on('disconnect', leave);

    client.on('create', function (channel, fn) {
        // send channel
        fn(null, channel);

        // add self
        joinTo(channel);
    });

    // shareScreen unshareScreen

    // forward messages
    client.on('message', function (message) {
        message.from = client.id;
        io.sockets.socket(message.to).emit('message', message);
    });
});

console.log('Browse http://localhost:8001 or http://' + remoteIp()[0] + ':8001');
server.listen(8001, '0.0.0.0');
