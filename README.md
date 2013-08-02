# WebRTC signaling server for SimpleWebRTC

This is private signaling WebRTC server demo. It does not depend on `signaling.simplewebrtc.com:8888`.

## Running demo

**Important** It works perfectly in Firefox 22. Other browsers does not fully support WebRTC or getUserMedia DOM APIs.

```
$ git clone git://github.com/azproduction/SimpleWebRTC-server.git
$ cd SimpleWebRTC-server
$ npm i
$ node server
```

 - Open `http://localhost:8001/#room/webrtc` on multiple devices. That's it!
 - Both signaling and static servers are will be listening `0.0.0.0:8001` interface.
 - It takes about 5 seconds to establish a connection.

### Available Options

 - `peerConnectionConfig` - Set this to specify your own STUN and TURN servers. SimpleWebRTC uses Google's public STUN server by
 default: `stun.l.google.com:19302`. It's intended for public use according to: https://twitter.com/HenrikJoreteg/status/354105684591251456
