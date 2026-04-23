using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using sinalR.Models;

namespace sinalR.Hubs
{
    public class SignalingHub: Hub
    {

        private static readonly ConcurrentDictionary<string, string> _connections = new();

        public void Log(string text) => Console.WriteLine($"[{DateTime.Now:T}] {text}");

        public bool IsUsernameUnique(string name)
        {
            return !_connections.Values.Any(conn => conn.Equals(name, StringComparison.OrdinalIgnoreCase));
        }
        public async Task SendToOneUser(string targetUsername, string message)
        {
            // Find the SignalR ConnectionId associated with the username
            var target = _connections.FirstOrDefault(conn => conn.Value == targetUsername).Key;
            
            if (target != null)
            {
                // SignalR handles the JSON serialization automatically
                await Clients.Client(target).SendAsync("ReceiveMessage", message);
            }
        }

        public async Task SendUserListToAll()
        {
            var userList = _connections.Values.ToList();
            
            // "ReceiveUserList" is the method name the client listens for
            // ADD THIS TO CLIENT-SIDE CODE:
            await Clients.All.SendAsync("ReceiveMessage", new { type = "userlist", users = userList });
        }

        public async Task SendMessage(JsonElement rawData)
        {   try
            {
                var jsonString = rawData.GetRawText();
                Console.WriteLine($"Raw JSON received: {jsonString}");
                /*
                var msg = JsonSerializer.Deserialize<BaseMessage>(jsonString);
                if (msg == null) return;
                */
                bool sendToClients = true;
                var type = rawData.GetProperty("type").GetString();

                BaseMessage? msg = type switch
                {
                    "username" => rawData.Deserialize<UsernameMessage>(),
                    "message" => rawData.Deserialize<ChatMessage>(),
                    "video-offer" => rawData.Deserialize<VideoOfferMessage>(),
                    "video-answer" => rawData.Deserialize<VideoAnswerMessage>(),
                    "new-ice-candidate" => rawData.Deserialize<IceCandidateMessage>(),
                    "hang-up" => rawData.Deserialize<HangUpMessage>(),
                    "userlist" => rawData.Deserialize<UserListMessage>(),
                    "rejectusername" => rawData.Deserialize<Rejectusername>(),

                    // add more here
                    _ => throw new Exception($"Unknown type: {type}")
                };

                switch (msg.Type)
                {
                    // Public message
                    case "message":
                        msg.Name = _connections[Context.ConnectionId];

                        // Remove HTML tags
                        if (msg is ChatMessage chatMsg)
                        {
                            chatMsg.Text = Regex.Replace(chatMsg.Text, "<.*?>", string.Empty);
                        }
                        break;

                    // Username change
                    case "username":
                        bool nameChanged = false;
                        string originalName = msg.Name;
                        int append = 1;

                        while (!IsUsernameUnique(msg.Name))
                        {
                            msg.Name = originalName + append;
                            append++;
                            nameChanged = true;
                        }

                        if (nameChanged)
                        {
                            await Clients.Caller.SendAsync("ReceiveMessage", new Rejectusername
                            {
                                Type = "rejectusername",
                                Name = msg.Name,
                                Id = ((Rejectusername)msg).Id
                            });
                        }
                        // Update the username in the connections dictionary
                        _connections[Context.ConnectionId] = msg.Name;

                        await SendUserListToAll();
                        sendToClients = false;
                        break;
                }

                if (sendToClients)
                {
                    if (!string.IsNullOrEmpty(msg.Target))
                    {
                        // Send to specific user
                        var targetConn = _connections
                            .FirstOrDefault(x => x.Value == msg.Target).Key;

                        if (targetConn != null)
                        {
                            await Clients.Client(targetConn)
                                .SendAsync("ReceiveMessage", msg);
                        }
                    }
                    else
                    {
                        // Broadcast
                        await Clients.All.SendAsync("ReceiveMessage", msg);
                    }
                }
            }
            catch (Exception ex)
            {
                Log($"JSON deserialization error: {ex.Message}");
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            // Remove connection
            _connections.Remove(Context.ConnectionId, out _);

            // Send updated user list
            await SendUserListToAll();

            // Build log message
            string reason = exception?.Message ?? "Client disconnected";
            string description = exception?.InnerException?.Message ?? "";

            string logMessage = $"Connection closed: {Context.ConnectionId} ({reason}";

            if (!string.IsNullOrEmpty(description))
            {
                logMessage += $": {description}";
            }

            logMessage += ")";

            Console.WriteLine(logMessage);

            await base.OnDisconnectedAsync(exception);
        }
    }
}