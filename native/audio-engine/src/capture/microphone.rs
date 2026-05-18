use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc::Sender,
    Arc,
};
use std::thread;
use std::time::Duration;

use anyhow::Context;
use base64::{engine::general_purpose, Engine as _};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

use crate::audio::{
    f32_interleaved_to_mono_i16, i16_interleaved_to_mono_i16, pcm_i16_to_le_bytes, peak_i16,
    resample_i16_linear, rms_i16, u16_interleaved_to_mono_i16, Chunker, OUTPUT_CHANNELS,
    OUTPUT_SAMPLE_RATE, SAMPLES_PER_CHUNK,
};
use crate::devices::select_by_name;
use crate::protocol::EngineEvent;

const SOURCE_ID: &str = "you";

pub fn spawn(
    microphone_device_id: String,
    stop: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
    event_tx: Sender<EngineEvent>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        if let Err(error) = run(microphone_device_id, stop, paused, event_tx.clone()) {
            let _ = event_tx.send(EngineEvent::error(format!(
                "Microphone capture failed: {error}"
            )));
        }
    })
}

fn run(
    microphone_device_id: String,
    stop: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
    event_tx: Sender<EngineEvent>,
) -> anyhow::Result<()> {
    let host = cpal::default_host();
    let default_device = host
        .default_input_device()
        .context("no default microphone was found")?;
    let default_name = default_device.name().unwrap_or_default();
    let device = select_by_name(host.input_devices()?, &microphone_device_id, &default_name)
        .unwrap_or(default_device);
    let device_name = device
        .name()
        .unwrap_or_else(|_| "default microphone".to_string());
    let supported_config = device.default_input_config()?;
    let sample_format = supported_config.sample_format();
    let stream_config: cpal::StreamConfig = supported_config.clone().into();
    let input_rate = stream_config.sample_rate.0;
    let channels = stream_config.channels as usize;
    let err_tx = event_tx.clone();
    let err_fn = move |error| {
        let _ = err_tx.send(EngineEvent::error(format!(
            "Microphone stream error: {error}"
        )));
    };

    let _ = event_tx.send(EngineEvent::status(
        "capturing",
        format!("Microphone capture started: {device_name}."),
    ));

    let stream = match sample_format {
        cpal::SampleFormat::F32 => {
            let mut chunker = Chunker::new(SAMPLES_PER_CHUNK);
            let tx = event_tx.clone();
            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _| {
                    if paused.load(Ordering::SeqCst) {
                        return;
                    }
                    let mono = f32_interleaved_to_mono_i16(data, channels);
                    emit_samples(&tx, &mut chunker, &mono, input_rate);
                },
                err_fn,
                None,
            )?
        }
        cpal::SampleFormat::I16 => {
            let mut chunker = Chunker::new(SAMPLES_PER_CHUNK);
            let tx = event_tx.clone();
            device.build_input_stream(
                &stream_config,
                move |data: &[i16], _| {
                    if paused.load(Ordering::SeqCst) {
                        return;
                    }
                    let mono = i16_interleaved_to_mono_i16(data, channels);
                    emit_samples(&tx, &mut chunker, &mono, input_rate);
                },
                err_fn,
                None,
            )?
        }
        cpal::SampleFormat::U16 => {
            let mut chunker = Chunker::new(SAMPLES_PER_CHUNK);
            let tx = event_tx.clone();
            device.build_input_stream(
                &stream_config,
                move |data: &[u16], _| {
                    if paused.load(Ordering::SeqCst) {
                        return;
                    }
                    let mono = u16_interleaved_to_mono_i16(data, channels);
                    emit_samples(&tx, &mut chunker, &mono, input_rate);
                },
                err_fn,
                None,
            )?
        }
        sample_format => anyhow::bail!("unsupported microphone sample format: {sample_format:?}"),
    };

    stream.play()?;

    while !stop.load(Ordering::SeqCst) {
        thread::sleep(Duration::from_millis(50));
    }

    drop(stream);
    Ok(())
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
