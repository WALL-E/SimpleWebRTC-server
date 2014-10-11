# WebRTC signaling server for SimpleWebRTC

This is private signaling WebRTC server demo. It does not depend on `signaling.simplewebrtc.com:8888`.

## Running demo

**Important** 
It works perfectly in Firefox 32 and Chrome 34. 
Other browsers does not fully support WebRTC or getUserMedia DOM APIs.

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

国内的话，最好使用自己的stun服务器。原因，你懂的。.

================================================
Ubuntu:
安装服务器
sudo apt-get install stun
配置服务器,必须配置两个IP地址，不然，无法启动
/etc/default/stun
启动stun服务器
/etc/init.d/stun start
测试stun服务
stun server_ip

服务器搭建完之后，修改simplewebrtc/simplewebrtc.bundle.js文件即可。
`peerConnectionConfig` - 修改这个配置段即可，之后浏览器刷新即可使用新的Stun服务器了


