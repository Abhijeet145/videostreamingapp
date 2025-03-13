import React from "react"
import AgoraRTM from "agora-rtm-sdk"
import { useLocation } from "react-router"
import { useNavigate } from "react-router"
let first=true
const StreamHandler = () => {
    const navigate = useNavigate();
    const {state} = useLocation();
    const { RoomId,isStreamer } = state; 
    const servers = {
        iceServers : [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun.l.google.com:5349",
                    "stun:stun1.l.google.com:3478",
                    "stun:stun1.l.google.com:5349",
                ]
            }  
        ]
    }
    // console.log('Room ID');
    console.log(RoomId);
    let APP_ID = "e996accb35234d22bf92922376441efb"
    let token = null

    let uid = String(Math.floor(Math.random()*10000))

    let client
    let channel
    const memIds = new Set([2,3,4,5,6,7])
    const members = new Map([])
    // let memberNumber = 1
    const maxUsers = 7
    const audioVal = true
    //  //later need to create a roomID to get from user
    let roomID = RoomId

    let localStream
    let localVideoStream
    let remoteStream = new Map([])
    let peerConnection = new Map([])
    let init = async()=>{
        window.addEventListener('beforeunload',leaveChannel)
        // Create a client instance 
        client = await AgoraRTM.createInstance(APP_ID)
        
        await client.login({uid,token})

        channel = client.createChannel(roomID)
        await channel.join()

        channel.on('MemberJoined',handleUserJoined)

        client.on('MessageFromPeer',handleMessageFromPeer)

        channel.on('MemberLeft' , handleUserLeft)

        localVideoStream = await navigator.mediaDevices.getUserMedia({video:true,audio:false})
        localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:audioVal})
        if(isStreamer)
            document.getElementById('user-1').srcObject = localVideoStream

    }

    let leaveChannel = async()=>{
        await channel.leaveChannel()
        await client.logout()
        navigate('/');
    }
    
    let initialize=()=>{
        if(first===true){
            first = false
            init()
        }
    }
    
    initialize()

    let handleMessageFromPeer = async(message,MemberId)=>{
        
        message = JSON.parse(message.text)
        // console.log('Handling some message from user')
        if(message.type === 'offer'){
            // for(let i=2;i<=maxUsers;i++){
            //     if(memIds.has(i) === true){
            //         memberNumber = i;
            //         memIds.delete(i);//delete this user
            //         break;
            //     }
            // }
            // members.set(MemberId,memberNumber)
            createAnswer(MemberId, message.offer)
        }
    
        else if(message.type === 'answer'){
            addAnswer(message.answer,MemberId)
        }
    
        else if(message.type === 'candidate'){
            if(peerConnection.get(MemberId)){
                peerConnection.get(MemberId).addIceCandidate(message.candidate)
            }
        }
        else if(message.type === 'Leaving'){
            console.log("Leaving was called");
            // for(let i = 2;i<=maxUsers;i++){
            //     if(members.get(MemberId) === i){
            //         document.getElementById(`user-${i}`).style.display = 'none'
            //         memIds.add(i)//when user leaves add this as a potential user
            //         members.delete(MemberId)
            //     }
            // }
        }
    
    }

    let handleUserJoined = async (MemberId)=>{
        if(isStreamer){
            // members.set(MemberId,memberNumber)
            // console.log('A new user joined this channel: ',MemberId)
            createOffer(MemberId);
        }
    }

    let handleUserLeft = async (MemberId)=>{
        // for(let i = 2;i<=maxUsers;i++){
        //     if(members.get(MemberId) === i){
        //         document.getElementById(`user-${i}`).style.display = 'none'
        //         memIds.add(i)//when user leaves add this as a potential user
        //         members.delete(MemberId)
        //     }
        // }
    }

    let createPeerConnectoion = async(MemberId)=>{
        let connection = new RTCPeerConnection(servers)
        peerConnection.set(MemberId,connection)

        //handle the remote stream for receivers of stream(downstream)
        if(isStreamer === false){
            let stream = new MediaStream()
            remoteStream.set(MemberId,stream)
            document.getElementById(`user-1`).srcObject = stream
            document.getElementById(`user-1`).style.display = 'block'
            // console.log('I am adding remote stream');

            connection.ontrack = (event)=>{
                event.streams[0].getTracks().forEach(async track=>{
                    await stream.addTrack(track)
                })
            }
        }
        
        //if a streamer then it will set the upstream
        if(isStreamer === true){
            if(!localStream){
                localVideoStream = await navigator.mediaDevices.getUserMedia({video:true,audio:false})
                localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:audioVal})
                document.getElementById('user-1').srcObject = localVideoStream
            }
    
            //Adds all the tracks to peerConnection
            localStream.getTracks().forEach( async track => {
                await connection.addTrack(track,localStream)
            })
            console.log("Tracks added to localstream");

        }
        // if(isStreamer === false){
            //here connection ontrack was present
        // }
        
        //send ice candidates
        connection.onicecandidate = async (event)=>{
            if(event.candidate){
                await client.sendMessageToPeer({text:JSON.stringify({'type':'candidate','candidate':event.candidate})},MemberId)
            }
        }
       
    }

    let createOffer = async(MemberId)=>{
        await createPeerConnectoion(MemberId);

        console.log('connection established successfully')

        let offer = await peerConnection.get(MemberId).createOffer()
        await peerConnection.get(MemberId).setLocalDescription(offer)
        console.log('Offer created')

        client.sendMessageToPeer({text:JSON.stringify({'type':'offer','offer':offer})},MemberId)
        console.log('Offer sent')
    }


    let createAnswer = async(MemberId,offer)=>{
        await createPeerConnectoion(MemberId)

        await peerConnection.get(MemberId).setRemoteDescription(offer)

        let answer = await peerConnection.get(MemberId).createAnswer()
        await peerConnection.get(MemberId).setLocalDescription(answer)
        
        client.sendMessageToPeer({text:JSON.stringify({'type':'answer','answer':answer})},MemberId)
    }

    let addAnswer = async(answer,MemberId)=>{
        if(!peerConnection.get(MemberId).currentRemoteDescription){
            peerConnection.get(MemberId).setRemoteDescription(answer)
        }
    }
    let videoON = true;

    let toggleCamera = async () => {
         //get the videotrack from stream
        let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

        if(videoTrack.enabled){
            videoTrack.enabled = false
            document.getElementById('user-1').srcObject = null
            document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
        }else{
            videoTrack.enabled = true
            document.getElementById('user-1').srcObject = localVideoStream
            document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
        }
    }

    let toggleMic = async () => {
        //get the audiotrack from stream
        let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

        if(audioTrack.enabled){
            audioTrack.enabled = false
            document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
        }else{
            audioTrack.enabled = true
            document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
        }
    }

    if(isStreamer === true ){
        return(
            <>
            <div id="streamer">Streaming</div>
                <div id="controls">
        
                <div class="control-container" id="camera-btn">
                    <img src={require('./icons/camera.png')} alt='camera button' onClick={toggleCamera}/>
                </div>
        
                <div class="control-container" id="mic-btn">
                    <img src={require('./icons/mic.png')} alt='mic button' onClick={toggleMic}/>
                </div>
        
                <a href="/videostreamingapp/">
                    <div class="control-container" id="leave-btn">
                        <img src={require('./icons/phone.png')} alt='phone button' onClick={leaveChannel}/>
                    </div>
                </a>
                <div id="roomid"><h3>Room ID : {roomID}</h3></div>
                </div>
            </>
            )
    }else{
        return(
        <>
        <div id="receiver"> Live </div>
            <div id="controls">

            <a href="/videostreamingapp/">
                <div class="control-container" id="leave-btn">
                    <img src={require('./icons/phone.png')} alt='phone button' onClick={leaveChannel}/>
                </div>
            </a>
            <div id="roomid"><h3>Room ID : {roomID}</h3></div>
            </div>
        </>
        )
    }
}

export default StreamHandler
