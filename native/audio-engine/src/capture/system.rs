use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc::Sender,
    Arc,
};
use std::thread;

use crate::protocol::EngineEvent;

const SOURCE_ID: &str = "others";

#[cfg(windows)]
pub fn spawn(
    system_audio_device_id: String,
    stop: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
    event_tx: Sender<EngineEvent>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        if let Err(error) = windows_loopback::run(system_audio_device_id, stop, paused, event_tx.clone()) {
            let _ = event_tx.send(EngineEvent::error(format!("System audio capture failed: {error}")));
        }
    })
}

#[cfg(not(windows))]
pub fn spawn(
    _system_audio_device_id: String,
    _stop: Arc<AtomicBool>,
    _paused: Arc<AtomicBool>,
    event_tx: Sender<EngineEvent>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let _ = event_tx.send(EngineEvent::error(
            "System audio loopback is only implemented for Windows in this build.",
        ));
    })
}

#[cfg(windows)]
mod windows_loopback {
    use std::ptr::null_mut;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::Sender,
        Arc,
    };
    use std::thread;
    use std::time::Duration;

    use anyhow::Context;
    use base64::{engine::general_purpose, Engine as _};
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator,
        AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
        DEVICE_STATE_ACTIVE, MMDeviceEnumerator, WAVEFORMATEX,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
        COINIT_MULTITHREADED,
    };

    use crate::audio::{
        f32_interleaved_to_mono_i16, i16_interleaved_to_mono_i16, pcm_i16_to_le_bytes, peak_i16,
        resample_i16_linear, rms_i16, Chunker, OUTPUT_CHANNELS, OUTPUT_SAMPLE_RATE,
        SAMPLES_PER_CHUNK,
    };
    use crate::protocol::EngineEvent;

    const SOURCE_ID: &str = super::SOURCE_ID;
    const WAVE_FORMAT_PCM: u16 = 0x0001;
    const WAVE_FORMAT_IEEE_FLOAT: u16 = 0x0003;
    const WAVE_FORMAT_EXTENSIBLE: u16 = 0xfffe;
    const REFTIMES_PER_SEC: i64 = 10_000_000;

    pub fn run(
        system_audio_device_id: String,
        stop: Arc<AtomicBool>,
        paused: Arc<AtomicBool>,
        event_tx: Sender<EngineEvent>,
    ) -> anyhow::Result<()> {
        unsafe {
            CoInitializeEx(None, COINIT_MULTITHREADED)?;
        }

        let result = unsafe { run_inner(system_audio_device_id, stop, paused, event_tx) };

        unsafe {
            CoUninitialize();
        }

        result
    }

    unsafe fn run_inner(
        system_audio_device_id: String,
        stop: Arc<AtomicBool>,
        paused: Arc<AtomicBool>,
        event_tx: Sender<EngineEvent>,
    ) -> anyhow::Result<()> {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = if system_audio_device_id.trim().is_empty() {
            enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?
        } else {
            let wide_id = wide_null(&system_audio_device_id);
            enumerator
                .GetDevice(PCWSTR(wide_id.as_ptr()))
                .or_else(|_| enumerator.GetDefaultAudioEndpoint(eRender, eConsole))?
        };
        let audio_client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;
        let format_ptr = audio_client.GetMixFormat()?;
        let format = *format_ptr;
        let sample_rate = format.nSamplesPerSec;
        let channels = format.nChannels as usize;
        let bits_per_sample = format.wBitsPerSample;
        let block_align = format.nBlockAlign as usize;

        audio_client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            REFTIMES_PER_SEC / 2,
            0,
            format_ptr,
            None,
        )?;
        let capture_client: IAudioCaptureClient = audio_client.GetService()?;

        let _ = event_tx.send(EngineEvent::status(
            "capturing",
            "System audio loopback capture started.",
        ));

        audio_client.Start()?;
        let mut chunker = Chunker::new(SAMPLES_PER_CHUNK);

        while !stop.load(Ordering::SeqCst) {
            let mut packet_frames = capture_client.GetNextPacketSize()?;
            if packet_frames == 0 {
                thread::sleep(Duration::from_millis(5));
                continue;
            }

            while packet_frames > 0 {
                let mut data: *mut u8 = null_mut();
                let mut frames_available = 0_u32;
                let mut flags = 0_u32;
                capture_client.GetBuffer(
                    &mut data,
                    &mut frames_available,
                    &mut flags,
                    None,
                    None,
                )?;

                if !paused.load(Ordering::SeqCst) {
                    let sample_count = frames_available as usize * channels;
                    let mono = if flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 {
                        vec![0_i16; frames_available as usize]
                    } else {
                        convert_wasapi_packet(
                            data,
                            sample_count,
                            block_align,
                            bits_per_sample,
                            channels,
                            format.wFormatTag,
                        )
                    };

                    emit_samples(&event_tx, &mut chunker, &mono, sample_rate);
                }

                capture_client.ReleaseBuffer(frames_available)?;
                packet_frames = capture_client.GetNextPacketSize()?;
            }
        }

        audio_client.Stop()?;
        CoTaskMemFree(Some(format_ptr.cast()));
        let _ = event_tx.send(EngineEvent::Stopped);
        Ok(())
    }

    unsafe fn convert_wasapi_packet(
        data: *mut u8,
        sample_count: usize,
        block_align: usize,
        bits_per_sample: u16,
        channels: usize,
        format_tag: u16,
    ) -> Vec<i16> {
        if data.is_null() || sample_count == 0 || channels == 0 {
            return Vec::new();
        }

        if format_tag == WAVE_FORMAT_IEEE_FLOAT
            || (format_tag == WAVE_FORMAT_EXTENSIBLE && bits_per_sample == 32)
        {
            let samples = std::slice::from_raw_parts(data as *const f32, sample_count);
            return f32_interleaved_to_mono_i16(samples, channels);
        }

        if format_tag == WAVE_FORMAT_PCM || bits_per_sample == 16 {
            let samples = std::slice::from_raw_parts(data as *const i16, sample_count);
            return i16_interleaved_to_mono_i16(samples, channels);
        }

        let byte_count = sample_count.saturating_mul(block_align / channels.max(1));
        let bytes = std::slice::from_raw_parts(data, byte_count);
        bytes
            .chunks(block_align / channels.max(1))
            .map(|sample| {
                if sample.len() >= 2 {
                    i16::from_le_bytes([sample[0], sample[1]])
                } else {
                    0
                }
            })
            .collect::<Vec<_>>()
    }

    fn emit_samples(
        event_tx: &Sender<EngineEvent>,
        chunker: &mut Chunker,
        samples: &[i16],
        input_rate: u32,
    ) {
        let resampled = resample_i16_linear(samples, input_rate, OUTPUT_SAMPLE_RATE);
        for chunk in chunker.push(&resampled) {
            let rms = rms_i16(&chunk);
            let peak = peak_i16(&chunk);
            let bytes = pcm_i16_to_le_bytes(&chunk);
            let encoded = general_purpose::STANDARD.encode(bytes);

            let _ = event_tx.send(EngineEvent::Level {
                source_id: SOURCE_ID.to_string(),
                rms,
                peak,
            });
            let _ = event_tx.send(EngineEvent::AudioChunk {
                source_id: SOURCE_ID.to_string(),
                sample_rate: OUTPUT_SAMPLE_RATE,
                channels: OUTPUT_CHANNELS,
                pcm_base64: encoded,
                rms,
            });
        }
    }

    fn wide_null(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    #[allow(dead_code)]
    unsafe fn _enumerate_render_devices(
        enumerator: &IMMDeviceEnumerator,
    ) -> anyhow::Result<usize> {
        let collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
        Ok(collection.GetCount()? as usize)
    }
}
