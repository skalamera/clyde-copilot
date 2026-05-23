import { AgentEventsEnum, LiveAvatarSession, SessionEvent } from '@heygen/liveavatar-web-sdk';

export class RealtimeInterviewService {
    constructor() {
        this.session = null;
        this.onMessage = null;
        this.onStateChange = null;
        this.videoRef = null;
        this.voiceStartTimer = null;
        this.transcriptionChunks = new Map();
    }

    setVideoElement(videoEl) {
        this.videoRef = videoEl;
    }

    async connect(options = {}) {
        try {
            this._notifyState('connecting');

            // 1. Fetch Session Token from backend dynamically using the opportunity info
            const sessionToken = await window.electronAPI.generateMockInterviewSessionToken({
                opportunity: options.opportunity || {}
            });

            if (!sessionToken) {
                throw new Error('Failed to retrieve session token from backend.');
            }

            // 2. Initialize the SDK session
            this.session = new LiveAvatarSession(sessionToken);
            this.transcriptionChunks.clear();

            // 3. Attach Event Listeners
            this.session.on(SessionEvent.SESSION_STREAM_READY, () => {
                if (this.videoRef) {
                    this.session.attach(this.videoRef);
                    this.videoRef.play?.().catch?.(() => {});
                }
                this._notifyState('connected');
                this.voiceStartTimer = window.setTimeout(() => {
                    this.session?.voiceChat?.start?.();
                }, 800);
            });

            this.session.on(SessionEvent.SESSION_DISCONNECTED, () => {
                this._notifyState('disconnected');
            });

            this.session.on(AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
                this._forwardTranscription('you', event, { final: true });
            });

            this.session.on(AgentEventsEnum.USER_TRANSCRIPTION_CHUNK, (event) => {
                this._forwardTranscription('you', event, { final: false });
            });

            this.session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event) => {
                this._forwardTranscription('interviewer', event, { final: true });
            });

            this.session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK, (event) => {
                this._forwardTranscription('interviewer', event, { final: false });
            });

            this.session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
                if (this.onMessage) this.onMessage({ type: 'input_audio_buffer.speech_started' });
            });

            this.session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
                if (this.onMessage) this.onMessage({ type: 'input_audio_buffer.speech_stopped' });
            });

            this.session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
                if (this.onMessage) this.onMessage({ type: 'response.audio.delta' });
            });

            this.session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
                if (this.onMessage) this.onMessage({ type: 'response.audio.done' });
            });

            // 4. Start the session
            await this.session.start();

        } catch (error) {
            console.error('Realtime connection failed:', error);
            this._notifyState('error');
            this.disconnect();
            throw error;
        }
    }

    sendEvent(eventObj) {
        // Only implemented if we need to send manual text/interrupts
        if (this.session && eventObj.type === 'avatar.interrupt') {
            this.session.interrupt();
        }
    }

    disconnect() {
        if (this.voiceStartTimer) {
            window.clearTimeout(this.voiceStartTimer);
            this.voiceStartTimer = null;
        }
        if (this.session) {
            this.session.stop();
            this.session = null;
        }
        this._notifyState('disconnected');
    }

    _notifyState(state) {
        if (this.onStateChange) {
            this.onStateChange(state);
        }
    }

    _forwardTranscription(role, event, { final }) {
        const itemId = event?.source_event_id || event?.event_id || `${role}-${Date.now()}`;
        const text = final ? event?.text : this._appendTranscriptionChunk(itemId, event?.text);

        if (!text || !this.onMessage) {
            return;
        }

        if (final) {
            this.transcriptionChunks.delete(itemId);
        }

        if (role === 'you') {
            this.onMessage({
                type: 'conversation.item.input_audio_transcription.completed',
                transcript: text,
                item_id: itemId
            });
            return;
        }

        this.onMessage({
            type: 'response.output_text.delta',
            delta: text,
            response_id: itemId
        });
    }

    _appendTranscriptionChunk(itemId, chunk = '') {
        const next = `${this.transcriptionChunks.get(itemId) || ''}${chunk}`;
        this.transcriptionChunks.set(itemId, next);
        return next;
    }
}
