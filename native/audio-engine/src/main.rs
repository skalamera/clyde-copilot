use std::io::{self, BufRead, Write};
use std::sync::mpsc;
use std::thread;

use clyde_audio_engine::capture::CaptureSession;
use clyde_audio_engine::devices::list_devices;
use clyde_audio_engine::protocol::{parse_command, serialize_event, EngineCommand, EngineEvent};

fn main() -> anyhow::Result<()> {
    let (event_tx, event_rx) = mpsc::channel::<EngineEvent>();
    let writer = thread::spawn(move || {
        let stdout = io::stdout();
        let mut handle = stdout.lock();

        for event in event_rx {
            match serialize_event(&event) {
                Ok(line) => {
                    if writeln!(handle, "{line}").is_err() {
                        break;
                    }
                    let _ = handle.flush();
                }
                Err(error) => {
                    let _ = writeln!(
                        handle,
                        "{{\"type\":\"error\",\"message\":\"Failed to serialize event: {error}\"}}"
                    );
                    let _ = handle.flush();
                }
            }
        }
    });

    let _ = event_tx.send(EngineEvent::Ready);

    let stdin = io::stdin();
    let mut capture_session: Option<CaptureSession> = None;

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(line) => line,
            Err(error) => {
                let _ = event_tx.send(EngineEvent::error(format!(
                    "Failed to read command: {error}"
                )));
                continue;
            }
        };

        let command = match parse_command(&line) {
            Ok(command) => command,
            Err(error) => {
                let _ = event_tx.send(EngineEvent::error(format!("Invalid command: {error}")));
                continue;
            }
        };

        match command {
            EngineCommand::ListDevices => match list_devices() {
                Ok(devices) => {
                    let _ = event_tx.send(EngineEvent::DeviceList {
                        default_microphone_id: devices.default_microphone_id,
                        default_system_audio_id: devices.default_system_audio_id,
                        microphones: devices.microphones,
                        system_outputs: devices.system_outputs,
                    });
                }
                Err(error) => {
                    let _ = event_tx.send(EngineEvent::error(format!(
                        "Failed to list audio devices: {error}"
                    )));
                }
            },
            EngineCommand::StartCapture {
                microphone_device_id,
                system_audio_device_id,
            } => {
                if let Some(session) = capture_session.take() {
                    session.stop();
                    let _ = event_tx.send(EngineEvent::Stopped);
                }

                capture_session = Some(CaptureSession::start(
                    microphone_device_id,
                    system_audio_device_id,
                    event_tx.clone(),
                ));
                let _ = event_tx.send(EngineEvent::status(
                    "capturing",
                    "Rust audio engine capture started.",
                ));
            }
            EngineCommand::Pause => {
                if let Some(session) = capture_session.as_ref() {
                    session.pause();
                    let _ =
                        event_tx.send(EngineEvent::status("paused", "Rust audio engine paused."));
                }
            }
            EngineCommand::Resume => {
                if let Some(session) = capture_session.as_ref() {
                    session.resume();
                    let _ = event_tx.send(EngineEvent::status(
                        "capturing",
                        "Rust audio engine resumed.",
                    ));
                }
            }
            EngineCommand::Stop => {
                if let Some(session) = capture_session.take() {
                    session.stop();
                }
                let _ = event_tx.send(EngineEvent::Stopped);
            }
            EngineCommand::Shutdown => {
                if let Some(session) = capture_session.take() {
                    session.stop();
                }
                let _ = event_tx.send(EngineEvent::Stopped);
                break;
            }
        }
    }

    drop(event_tx);
    let _ = writer.join();
    Ok(())
}
