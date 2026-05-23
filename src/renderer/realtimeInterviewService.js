import { AgentEventsEnum, LiveAvatarSession, SessionEvent } from '@heygen/liveavatar-web-sdk';

export class RealtimeInterviewService {
    constructor() {
        this.session = null;
        this.onMessage = null;
        this.onStateChange = null;
        this.videoRef = null;
        this.voiceStartTimer = null;
        this.transcriptionChunks = new Map();
        this.activeTranscriptions = new Map();
        this.recentFinalTranscriptions = new Map();
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
            this.activeTranscriptions.clear();
            this.recentFinalTranscriptions.clear();

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
                this._startTranscriptionTurn('you');
                if (this.onMessage) this.onMessage({ type: 'input_audio_buffer.speech_started' });
            });

            this.session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
                if (this.onMessage) this.onMessage({ type: 'input_audio_buffer.speech_stopped' });
            });

            this.session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
                this._startTranscriptionTurn('interviewer');
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
        const itemId = this._getTranscriptionTurnId(role, event, { final });
        const text = final ? event?.text : this._appendTranscriptionChunk(role, itemId, event?.text);
        const hadActiveTurn = this.activeTranscriptions.has(role);

        if (!text || !this.onMessage) {
            return;
        }

        if (final && this._isDuplicateFinal(role, text) && !hadActiveTurn) {
            return;
        }

        if (final) {
            this._finishTranscriptionTurn(role, itemId, text);
        }

        if (role === 'you') {
            this.onMessage({
                type: 'conversation.item.input_audio_transcription.completed',
                transcript: text,
                item_id: itemId,
                partial: !final
            });
            return;
        }

        this.onMessage({
            type: 'response.output_text.delta',
            delta: text,
            response_id: itemId,
            partial: !final
        });
    }

    _startTranscriptionTurn(role) {
        this.activeTranscriptions.set(role, {
            id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            text: ''
        });
    }

    _getTranscriptionTurnId(role, event, { final }) {
        const active = this.activeTranscriptions.get(role);
        if (active) {
            return active.id;
        }

        if (final) {
            return event?.source_event_id || event?.event_id || `${role}-${Date.now()}`;
        }

        this._startTranscriptionTurn(role);
        return this.activeTranscriptions.get(role).id;
    }

    _appendTranscriptionChunk(role, itemId, chunk = '') {
        const active = this.activeTranscriptions.get(role) || { id: itemId, text: '' };
        const next = this._mergeTranscriptText(active.text || this.transcriptionChunks.get(itemId) || '', chunk);

        this.activeTranscriptions.set(role, { id: itemId, text: next });
        this.transcriptionChunks.set(itemId, next);
        return next;
    }

    _finishTranscriptionTurn(role, itemId, text) {
        this.transcriptionChunks.delete(itemId);
        this.activeTranscriptions.delete(role);
        this.recentFinalTranscriptions.set(role, {
            text: this._normalizeTranscriptText(text),
            timestamp: Date.now()
        });
    }

    _isDuplicateFinal(role, text) {
        const recent = this.recentFinalTranscriptions.get(role);
        return Boolean(
            recent &&
            Date.now() - recent.timestamp < 4000 &&
            recent.text === this._normalizeTranscriptText(text)
        );
    }

    _mergeTranscriptText(previous = '', chunk = '') {
        if (!previous) {
            return chunk;
        }
        if (!chunk || previous.endsWith(chunk)) {
            return previous;
        }
        if (chunk.startsWith(previous)) {
            return chunk;
        }

        const needsSpace = !/\s$/.test(previous) && !/^\s|^[.,!?;:)]/.test(chunk);
        return `${previous}${needsSpace ? ' ' : ''}${chunk}`;
    }

    _normalizeTranscriptText(text = '') {
        return text.trim().replace(/\s+/g, ' ').toLowerCase();
    }
}
