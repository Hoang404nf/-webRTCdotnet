"use strict";

let myHostname = window.location.hostname;
if (!myHostname) {
  myHostname = "localhost";
}
log("Hostname: " + myHostname);

// WebSocket chat/signaling channel variables.

const connection = new signalR.HubConnectionBuilder().withUrl("/chatHub").build();
let clientID = 0;

let mediaConstraints = {
  audio: true, // We want an audio track
  video: {
    aspectRatio: {
      ideal: 1.333333, // 3:2 aspect is preferred
    },
  },
};

let myUsername = null;
let targetUsername = null; // To store username of other peer
let myPeerConnection = null; // RTCPeerConnection
let transceiver = null; // RTCRtpTransceiver
let webcamStream = null; // MediaStream from webcam

// Output logging information to console.
function log(text) {
  let time = new Date();
  console.log("[" + time.toLocaleTimeString() + "] " + text);
}

// Output an error message to console.
function log_error(text) {
  let time = new Date();
  console.trace("[" + time.toLocaleTimeString() + "] " + text);
}

// Send a JavaScript object by converting it to JSON and sending
// it as a message on the WebSocket connection.

function sendToServer(msg) {
  let msgJSON = JSON.stringify(msg);
  log("Sending '" + msg.type + "' message: " + msgJSON);
  connection.invoke("SendMessage", msg).catch(function (err) {
        return console.error(err.toString());
    });

}

function setUsername() {
  myUsername = document.getElementById("name").value;
  //invoke inside sendToServer
  sendToServer({
    type: "username",
    name: myUsername,
    date: Date.now(),
    id: clientID
  });
}

// Open and configure the connection to the server.
function connect() {
  setUsername();
}

connection.on("ReceiveMessage",function (msg) {
  console.log("ReceiveMessage: " + msg);
  let chatBox = document.querySelector(".chatbox");
  let text = "";
  log("Message received: ");
  console.dir(msg);
  let time = new Date(msg.date);
  let timeStr = time.toLocaleTimeString();

  switch (msg.type) {
    case "username":
      text = `<b>User <em>${msg.name}</em> signed in at ${timeStr}</b><br>`;
      break;
    case "message":
      text = `(${timeStr}) <b>${msg.name}</b>: ${msg.text}<br>`;
      break;
    case "rejectusername":
      myUsername = msg.name;
      text = `<b>Your username has been set to <em>${myUsername}</em> because the name you chose is in use.</b><br>`;
      break;
    case "userlist":
      handleUserlistMsg(msg);
      break;
    case "video-offer":
      handleVideoOfferMsg(msg);
      break;
    case "video-answer":
      handleVideoAnswerMsg(msg);
      break;
    case "new-ice-candidate":
      handleNewICECandidateMsg(msg);
      break;
    case "hang-up":
      handleHangUpMsg(msg);
      break;
    default:
      log_error("Unknown message received:");
      log_error(msg);
  }

  if (text.length) {
    chatBox.innerHTML += text;
    chatBox.scrollTop = chatBox.scrollHeight - chatBox.clientHeight;
  }
});
//}

// Handles a click on the Send button (or pressing return/enter) by
// building a "message" object and sending it to the server.
function handleSendButton() {
  let msg = {
    type: "message",
    text: document.getElementById("text").value,
    id: clientID,
    date: Date.now(),
  };
  sendToServer(msg);
  document.getElementById("text").value = "";
}

// text message
function handleKey(evt) {
  if (evt.keyCode === 13 || evt.keyCode === 14) {
    if (!document.getElementById("send").disabled) {
      handleSendButton();
    }
  }
}

// Create the RTCPeerConnection -> selected STUN/TURN server
//  getUserMedia() -> find camera and microphone -> add to connection
async function createPeerConnection() {
  log("Setting up a connection...");

  // Create an RTCPeerConnection which knows to use our chosen
  // STUN server.

  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      // Information about ICE servers - Use your own!
      {
        'urls': 'stun:stun.l.google.com:19302'
      },
    ],
  });

  // Set up event handlers for the ICE negotiation process.

  myPeerConnection.onicecandidate = handleICECandidateEvent;
  myPeerConnection.oniceconnectionstatechange =
    handleICEConnectionStateChangeEvent;
  myPeerConnection.onicegatheringstatechange =
    handleICEGatheringStateChangeEvent;
  myPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;
  myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;
  myPeerConnection.ontrack = handleTrackEvent;
}

// Called by the WebRTC layer to let us know when it's time to
// begin, resume, or restart ICE negotiation.

async function handleNegotiationNeededEvent() {
  log("*** Negotiation needed");
  try {
    log("---> Creating offer");
    const offer = await myPeerConnection.createOffer();

    // If the connection hasn't yet achieved the "stable" state,
    // return to the caller. Another negotiationneeded event
    // will be fired when the state stabilizes.

    if (myPeerConnection.signalingState != "stable") {
      log("     -- The connection isn't stable yet; postponing...");
      return;
    }

    // Establish the offer as the local peer's current
    // description.

    log("---> Setting local description to the offer");
    await myPeerConnection.setLocalDescription(offer);

    // Send the offer to the remote peer.

    log("---> Sending the offer to the remote peer");
    sendToServer({
      type: "video-offer",
      name: myUsername,
      target: targetUsername,
      sdp: myPeerConnection.localDescription,
    });
  } catch (err) {
    log(
      "*** The following error occurred while handling the negotiationneeded event:",
    );
    reportError(err);
  }
}

// track events include the following fields:
//
// RTCRtpReceiver       receiver
// MediaStreamTrack     track
// MediaStream[]        streams
// RTCRtpTransceiver    transceiver

function handleTrackEvent(event) {
  log("*** Track event");
  document.getElementById("received_video").srcObject = event.streams[0];
  document.getElementById("hangup-button").disabled = false;
}

// Handles icecandidate events by forwarding the specified
// ICE candidate (created by our local ICE agent) to the other
// peer through the signaling server.

function handleICECandidateEvent(event) {
  if (event.candidate) {
    log("*** Outgoing ICE candidate: " + event.candidate.candidate);

    sendToServer({
      type: "new-ice-candidate",
      target: targetUsername,
      candidate: event.candidate,
    });
  }
}

// Handle |iceconnectionstatechange| events. This will detect
// when the ICE connection is closed, failed, or disconnected.
//
// This is called when the state of the ICE agent changes.

function handleICEConnectionStateChangeEvent(event) {
  log(
    "*** ICE connection state changed to " +
      myPeerConnection.iceConnectionState,
  );

  switch (myPeerConnection.iceConnectionState) {
    case "closed":
    case "failed":
    case "disconnected":
      closeVideoCall();
      break;
  }
}

// Set up a |signalingstatechange| event handler. This will detect when
// the signaling connection is closed.
function handleSignalingStateChangeEvent(event) {
  log(
    "*** WebRTC signaling state changed to: " + myPeerConnection.signalingState,
  );
  switch (myPeerConnection.signalingState) {
    case "closed":
      closeVideoCall();
      break;
  }
}

// Handle the |icegatheringstatechange| event. This lets us know what the
// ICE engine is currently working on: "new" means no networking has happened
// yet, "gathering" means the ICE engine is currently gathering candidates,
// and "complete" means gathering is complete.
function handleICEGatheringStateChangeEvent(event) {
  log(
    "*** ICE gathering state changed to: " + myPeerConnection.iceGatheringState,
  );
}

// Given a message containing a list of usernames, this function
// populates the user list box with those names, making each item
// clickable to allow starting a video call.

function handleUserlistMsg(msg) {
  let i;
  let listElem = document.querySelector(".userlistbox");

  // Remove all current list members.

  while (listElem.firstChild) {
    listElem.removeChild(listElem.firstChild);
  }

  // Add member names from the received list.

  msg.users.forEach(function (username) {
    let item = document.createElement("li");
    item.appendChild(document.createTextNode(username));
    item.addEventListener("click", invite, false);

    listElem.appendChild(item);
  });
}

// Close the RTCPeerConnection

function closeVideoCall() {
  let localVideo = document.getElementById("local_video");

  log("Closing the call");

  // Close the RTCPeerConnection

  if (myPeerConnection) {
    log("--> Closing the peer connection");

    // Disconnect all event listeners
    myPeerConnection.ontrack = null;
    myPeerConnection.onnicecandidate = null;
    myPeerConnection.oniceconnectionstatechange = null;
    myPeerConnection.onsignalingstatechange = null;
    myPeerConnection.onicegatheringstatechange = null;
    myPeerConnection.onnotificationneeded = null;

    // Stop all transceivers on the connection

    myPeerConnection.getTransceivers().forEach((transceiver) => {
      transceiver.stop();
    });

    // Stop the webcam preview as well by pausing the <video>
    // element, then stopping each of the getUserMedia() tracks
    // on it.

    if (localVideo.srcObject) {
      localVideo.pause();
      localVideo.srcObject.getTracks().forEach((track) => {
        track.stop();
      });
    }

    // Close the peer connection

    myPeerConnection.close();
    myPeerConnection = null;
    webcamStream = null;
  }

  // Disable the hangup button

  document.getElementById("hangup-button").disabled = true;
  targetUsername = null;
}

// Handle the "hang-up" message, which is sent if the other peer
// has hung up the call or otherwise disconnected.

function handleHangUpMsg(msg) {
  log("*** Received hang up notification from other peer");

  closeVideoCall();
}
// Hang up the call by closing the connection, then
// sending a "hang-up" message to the other peer
function hangUpCall() {
  closeVideoCall();

  sendToServer({
    type: "hang-up",
    name: myUsername,
    target: targetUsername,
  });
}

// Handle a click on an item in the user list by inviting the clicked
// user to video chat.
async function invite(evt) {
  log("Starting to prepare an invitation");
  if (myPeerConnection) {
    alert("You can't start a call because you already have one open!");
  } else {
    let clickedUsername = evt.target.textContent;
    // Don't allow users to call themselves, because weird.
    if (clickedUsername === myUsername) {
      alert(
        "I'm afraid I can't let you talk to yourself. That would be weird.",
      );
      return;
    }
    // Record the username being called for future reference
    targetUsername = clickedUsername;
    log("Inviting user " + targetUsername);
    // Call createPeerConnection() to create the RTCPeerConnection.
    log("Setting up connection to invite user: " + targetUsername);
    createPeerConnection();
    // Get access to the webcam stream and attach it to the
    // "preview" box (id "local_video").
    try {
      webcamStream =
        await navigator.mediaDevices.getUserMedia(mediaConstraints);
      document.getElementById("local_video").srcObject = webcamStream;
    } catch (err) {
      handleGetUserMediaError(err);
      return;
    }

    // Add the tracks from the stream to the RTCPeerConnection

    try {
      webcamStream.getTracks().forEach(
        (transceiver = (track) =>
          myPeerConnection.addTransceiver(track, {
            streams: [webcamStream],
          })),
      );
    } catch (err) {
      handleGetUserMediaError(err);
    }
  }
}

// Accept an offer to video chat. We configure our local settings,
// create our RTCPeerConnection, get and attach our local camera
// stream, then create and send an answer to the caller.

async function handleVideoOfferMsg(msg) {
  targetUsername = msg.name;

  // If we're not already connected, create an RTCPeerConnection
  // to be linked to the caller.

  log("Received video chat offer from " + targetUsername);
  if (!myPeerConnection) {
    createPeerConnection();
  }

  // Set the remote description to the received SDP offer
  // so that our local WebRTC layer knows how to talk to the caller.

  let desc = new RTCSessionDescription(msg.sdp);

  // If the connection isn't stable yet, wait for it...

  if (myPeerConnection.signalingState != "stable") {
    log("  - But the signaling state isn't stable, so triggering rollback");

    // Set the local and remove descriptions for rollback; don't proceed
    // until both return.
    await Promise.all([
      myPeerConnection.setLocalDescription({ type: "rollback" }),
      myPeerConnection.setRemoteDescription(desc),
    ]);
    return;
  } else {
    log("  - Setting remote description");
    await myPeerConnection.setRemoteDescription(desc);
  }

  // Get the webcam stream if we don't already have it

  if (!webcamStream) {
    try {
      webcamStream =
        await navigator.mediaDevices.getUserMedia(mediaConstraints);
    } catch (err) {
      handleGetUserMediaError(err);
      return;
    }

    document.getElementById("local_video").srcObject = webcamStream;

    // Add the camera stream to the RTCPeerConnection

    try {
      webcamStream.getTracks().forEach(
        (transceiver = (track) =>
          myPeerConnection.addTransceiver(track, {
            streams: [webcamStream],
          })),
      );
    } catch (err) {
      handleGetUserMediaError(err);
    }
  }

  log("---> Creating and sending answer to caller");

  await myPeerConnection.setLocalDescription(
    await myPeerConnection.createAnswer(),
  );

  sendToServer({
    type: "video-answer",
    name: myUsername,
    target: targetUsername,
    sdp: myPeerConnection.localDescription,
  });
}

// Responds to the "video-answer" message sent to the caller
// once the callee has decided to accept our request to talk.

async function handleVideoAnswerMsg(msg) {
  log("*** Call recipient has accepted our call");

  // Configure the remote description, which is the SDP payload
  // in our "video-answer" message.

  let desc = new RTCSessionDescription(msg.sdp);
  await myPeerConnection.setRemoteDescription(desc).catch(reportError);
}

// A new ICE candidate has been received from the other peer. Call
// RTCPeerConnection.addIceCandidate() to send it along to the
// local ICE framework.

async function handleNewICECandidateMsg(msg) {
  let candidate = new RTCIceCandidate(msg.candidate);

  log("*** Adding received ICE candidate: " + JSON.stringify(candidate));
  try {
    await myPeerConnection.addIceCandidate(candidate);
  } catch (err) {
    reportError(err);
  }
}

// Handle errors which occur when trying to access the local media hardware;
function handleGetUserMediaError(e) {
  log_error(e);
  switch (e.name) {
    case "NotFoundError":
      alert(
        "Unable to open your call because no camera and/or microphone" +
          "were found.",
      );
      break;
    case "SecurityError":
    case "PermissionDeniedError":
      // Do nothing; this is the same as the user canceling the call.
      break;
    default:
      alert("Error opening your camera and/or microphone: " + e.message);
      break;
  }

  // Make sure we shut down our end of the RTCPeerConnection so we're
  // ready to try again.

  closeVideoCall();
}

function reportError(errMessage) {
  log_error(`Error ${errMessage.name}: ${errMessage.message}`);
}

(async () => {
    try {
        await connection.start();
        document.getElementById("text").disabled = false;
        document.getElementById("send").disabled = false;
    }
    catch (e) {
        console.error(e.toString());
    }
})();
