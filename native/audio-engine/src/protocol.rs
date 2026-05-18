use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EngineCommand {
    ListDevices,
    StartCapture {
        #[serde(default, rename = "microphoneDeviceId")]
        microphone_device_id: String,
        #[serde(default, rename = "systemAudioDeviceId")]
        system_audio_device_id: String,
    },
    Pause,
    Resume,
    Stop,
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EngineEvent {
    Ready,
    DeviceList {
        #[serde(rename = "defaultMicrophoneId")]
        default_microphone_id: String,
        #[serde(rename = "defaultSystemAudioId")]
        default_system_audio_id: String,
        microphones: Vec<AudioDevice>,
        #[serde(rename = "systemOutputs")]
        system_outputs: Vec<AudioDevice>,
    },
    AudioChunk {
        #[serde(rename = "sourceId")]
        source_id: String,
        #[serde(rename = "sampleRate")]
        sample_rate: u32,
        channels: u16,
        #[serde(rename = "pcmBase64")]
        pcm_base64: String,
        rms: f32,
    },
    Level {
        #[serde(rename = "sourceId")]
        source_id: String,
        rms: f32,
        peak: f32,
    },
    Status {
        state: String,
        message: String,
    },
    Error {
        message: String,
    },
    Stopped,
}

impl EngineEvent {
    pub fn status(state: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Status {
            state: state.into(),
            message: message.into(),
        }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self::Error {
            message: message.into(),
        }
    }
}

pub fn parse_command(line: &str) -> anyhow::Result<EngineCommand> {
    Ok(serde_json::from_str(line)?)
}

pub fn serialize_event(event: &EngineEvent) -> anyhow::Result<String> {
    Ok(serde_json::to_string(event)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_start_capture_command() {
        let command = parse_command(
            r#"{"type":"start_capture","microphoneDeviceId":"mic","systemAudioDeviceId":"speakers"}"#,
        )
        .unwrap();

        assert_eq!(
            command,
            EngineCommand::StartCapture {
                microphone_device_id: "mic".to_string(),
                system_audio_device_id: "speakers".to_string(),
            }
        );
    }

    #[test]
    fn serializes_audio_chunk_event_as_camel_case_ndjson_payload() {
        let event = EngineEvent::AudioChunk {
            source_id: "you".to_string(),
            sample_rate: 48_000,
            channels: 1,
            pcm_base64: "AQID".to_string(),
            rms: 42.0,
        };
        let serialized = serialize_event(&event).unwrap();

        assert!(serialized.contains(r#""type":"audio_chunk""#));
        assert!(serialized.contains(r#""sourceId":"you""#));
        assert!(serialized.contains(r#""sampleRate":48000"#));
        assert!(serialized.contains(r#""pcmBase64":"AQID""#));
    }
}
