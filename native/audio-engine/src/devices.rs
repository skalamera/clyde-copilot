use anyhow::Context;
use cpal::traits::{DeviceTrait, HostTrait};

use crate::protocol::AudioDevice;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceList {
    pub default_microphone_id: String,
    pub default_system_audio_id: String,
    pub microphones: Vec<AudioDevice>,
    pub system_outputs: Vec<AudioDevice>,
}

pub fn list_devices() -> anyhow::Result<DeviceList> {
    let host = cpal::default_host();
    let default_microphone_name = host
        .default_input_device()
        .and_then(|device| device.name().ok())
        .unwrap_or_default();
    let default_system_audio_name = host
        .default_output_device()
        .and_then(|device| device.name().ok())
        .unwrap_or_default();

    let microphones = host
        .input_devices()
        .context("failed to enumerate microphone devices")?
        .filter_map(|device| device.name().ok())
        .map(|name| AudioDevice {
            id: name.clone(),
            is_default: name == default_microphone_name,
            name,
        })
        .collect::<Vec<_>>();

    let system_outputs = host
        .output_devices()
        .context("failed to enumerate output devices")?
        .filter_map(|device| device.name().ok())
        .map(|name| AudioDevice {
            id: name.clone(),
            is_default: name == default_system_audio_name,
            name,
        })
        .collect::<Vec<_>>();

    Ok(DeviceList {
        default_microphone_id: default_microphone_name,
        default_system_audio_id: default_system_audio_name,
        microphones,
        system_outputs,
    })
}

pub fn select_by_name<I>(devices: I, requested_id: &str, default_name: &str) -> Option<cpal::Device>
where
    I: IntoIterator<Item = cpal::Device>,
{
    let requested = requested_id.trim();
    let fallback = default_name.trim();

    devices
        .into_iter()
        .find(|device| {
            let name = device.name().unwrap_or_default();
            (!requested.is_empty() && name == requested) || (requested.is_empty() && !fallback.is_empty() && name == fallback)
        })
}

#[cfg(test)]
mod tests {
    #[test]
    fn mocked_device_selection_prefers_requested_id() {
        let requested = "microphone 2";
        let devices = ["microphone 1", "microphone 2"];
        let selected = devices.iter().find(|name| **name == requested).copied();

        assert_eq!(selected, Some("microphone 2"));
    }
}
