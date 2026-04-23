# 🎥 WebRTC + SignalR Real-Time Chat Application (.NET)

A real-time communication application built with **ASP.NET Core**, combining:

* 💬 Text messaging via SignalR
* 🎥 Face-to-face video calling via WebRTC
* 🌐 NAT traversal using STUN servers

---

## 🚀 Features

* 🔹 Real-time text chat (SignalR)
* 🔹 Peer-to-peer video call (WebRTC)
* 🔹 WebRTC signaling via SignalR
* 🔹 ICE candidate exchange
* 🔹 STUN server integration (for NAT traversal)
* 🔹 Low-latency communication

---

## 🧠 Architecture Overview

### 1. Messaging (SignalR)

Client-to-client communication is handled through a centralized SignalR Hub:

Client A → SignalR Server → Client B

* Reliable
* Server-mediated
* Suitable for text messages

---

### 2. Video Call (WebRTC)

Peer-to-peer connection using WebRTC:

Client A ←→ Client B
          ↑
   SignalR (Signaling)

SignalR is used only for:

* SDP (offer/answer) exchange
* ICE candidate exchange

Media stream flows directly between peers (P2P).

---

## 🛠️ Tech Stack

* Backend: ASP.NET Core (.NET)
* Real-time: SignalR
* Frontend: JavaScript (WebRTC API)
* Networking: STUN server

---

## ⚙️ How It Works

### WebRTC Flow

1. User A creates an SDP offer
2. Offer is sent to User B via SignalR
3. User B responds with SDP answer
4. ICE candidates are exchanged
5. Direct P2P connection is established

---

## 📦 Installation & Run

### Prerequisites

* .NET SDK
* Modern browser (Chrome, Edge, Firefox)

---

### Steps

```bash
# Clone repository
git clone https://github.com/Hoang404nf/-webRTCdotnet.git

# Navigate to project
cd -webRTCdotnet

# Run server
dotnet run
```

Open browser:

```
https://localhost:<port>
```

---

## 🌐 STUN Configuration

Example configuration:

```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
});
```

---

## ⚠️ Limitations

* ❌ No TURN server (may fail in strict NAT/firewall environments)
* ❌ No authentication system
* ❌ No room/group management
* ❌ Only supports 1-to-1 video calls

---

## 🚀 Future Improvements

* 🔸 Add TURN server support
* 🔸 Implement user authentication (JWT)
* 🔸 Add chat rooms / group calls
* 🔸 Screen sharing
* 🔸 File transfer (WebRTC DataChannel)
* 🔸 Online presence & typing indicator

---

## 📚 Learning Purpose

This project is designed to demonstrate:

* Real-time communication with SignalR
* WebRTC signaling and peer connection flow
* Integration between backend (.NET) and browser APIs

---

## 🤝 Contributing

Feel free to fork and improve the project.

---

## 📄 License

MIT License
