export class RealtimeInterviewService {
    constructor(api) {
        this.api = api;
        this.peerConnection = null;
        this.dataChannel = null;
        this.onMessage = null;
        this.onStateChange = null;
    }

    async connect(instructions = "You are a helpful voice assistant.") {
        try {
            this._notifyState('connecting');

            const tokenPayload = await this.api.getRealtimeToken();
            const token = typeof tokenPayload === 'string' ? tokenPayload : tokenPayload?.value;
            if (!token) {
                throw new Error('Realtime client secret is missing.');
            }

            this.peerConnection = new RTCPeerConnection();
            
            this.peerConnection.ontrack = (event) => {
                const el = document.createElement('audio');
                el.srcObject = event.streams[0];
                el.autoplay = true;
                el.controls = false;
                document.body.appendChild(el);
            };

            this.dataChannel = this.peerConnection.createDataChannel('oai-events');
            this.dataChannel.addEventListener('message', (event) => {
                try {
                    const realtimeEvent = JSON.parse(event.data);
                    if (this.onMessage) {
                        this.onMessage(realtimeEvent);
                    }
                } catch (err) {
                    console.error('Failed to parse realtime event:', err);
                }
            });
            this.dataChannel.addEventListener('open', () => {
                this.sendEvent({
                    type: 'session.update',
                    session: {
                        type: 'realtime',
                        instructions: instructions,
                        output_modalities: ['audio'],
                        audio: {
                            input: {
                                turn_detection: { type: 'semantic_vad' },
                                transcription: { model: 'gpt-realtime-whisper' }
                            },
                            output: {
                                voice: 'marin'
                            }
                        }
                    }
                });
                this._notifyState('connected');
            });

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => {
                this.peerConnection.addTrack(track, stream);
            });

            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            const response = await fetch('https://api.openai.com/v1/realtime/calls', {
                method: 'POST',
                body: offer.sdp,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/sdp'
                }
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`OpenAI SDP Exchange failed: ${text}`);
            }

            const answer = {
                type: 'answer',
                sdp: await response.text()
            };
            
            await this.peerConnection.setRemoteDescription(answer);

        } catch (error) {
            console.error('Realtime connection failed:', error);
            this._notifyState('error');
            this.disconnect();
            throw error;
        }
    }

    sendEvent(eventObj) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(eventObj));
        }
    }

    disconnect() {
        if (this.peerConnection) {
            this.peerConnection.getSenders().forEach((sender) => {
                if (sender.track) {
                    sender.track.stop();
                }
            });
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        this._notifyState('disconnected');
    }

    _notifyState(state) {
        if (this.onStateChange) {
            this.onStateChange(state);
        }
    }
}
