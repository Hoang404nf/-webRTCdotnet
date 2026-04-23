using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace sinalR.Models
{
    [JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
    [JsonDerivedType(typeof(UsernameMessage),"username")]
    [JsonDerivedType(typeof(ChatMessage), "message")]
    [JsonDerivedType(typeof(IceCandidateMessage), "new-ice-candidate")]
    [JsonDerivedType(typeof(HangUpMessage), "hang-up")]
    [JsonDerivedType(typeof(VideoOfferMessage), "video-offer")]
    [JsonDerivedType(typeof(VideoAnswerMessage), "video-answer")]
    public class BaseMessage
    {
        [JsonPropertyName("type")]
        public string? Type { get; set; }
        [JsonPropertyName("name")]
        public string? Name { get; set; }
        [JsonPropertyName("target")]
        public string? Target { get; set; }
    }
    // 2. Define the specific "Username" shape
    public class UsernameMessage : BaseMessage
    {
        [JsonPropertyName("date")]
        public long Date { get; set; }
        [JsonPropertyName("id")]
        public int? Id { get; set; }
    }

    public class ChatMessage : BaseMessage
    {
        [JsonPropertyName("text")]
        public string? Text { get; set; }
        [JsonPropertyName("id")]
        public int? Id { get; set; }
        [JsonPropertyName("date")]
        public long Date { get; set; }
    }

    // 3. Define the specific "Video-Offer" shape
    public class VideoOfferMessage : BaseMessage
    {
        [JsonPropertyName("sdp")]
        public object? Sdp { get; set; } // Or a specific SDP class
    }

    public class VideoAnswerMessage : BaseMessage
    {
        [JsonPropertyName("sdp")]
        public object? Sdp { get; set; }
    }
    public class IceCandidateMessage : BaseMessage
    {
        [JsonPropertyName("candidate")]
        public object? Candidate { get; set; } // Can be a specific 'RTCIceCandidate' class
    }
    public class HangUpMessage : BaseMessage
    {
    }
    public class UserListMessage : BaseMessage
    {  
        [JsonPropertyName("users")]
        public List<string>? Users { get; set; }
    }
    public class Rejectusername : BaseMessage
    {
        [JsonPropertyName("id")]
        public int? Id { get; set; }
    }
}