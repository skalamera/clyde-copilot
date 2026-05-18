use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc::Sender,
    Arc,
};
use std::thread::JoinHandle;

use crate::protocol::EngineEvent;

mod microphone;
mod system;

pub struct CaptureSession {
    stop: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
    handles: Vec<JoinHandle<()>>,
}

impl CaptureSession {
    pub fn start(
        microphone_device_id: String,
        system_audio_device_id: String,
        event_tx: Sender<EngineEvent>,
    ) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let paused = Arc::new(AtomicBool::new(false));
        let handles = vec![
            microphone::spawn(
                microphone_device_id,
                Arc::clone(&stop),
                Arc::clone(&paused),
                event_tx.clone(),
            ),
            system::spawn(
                system_audio_device_id,
                Arc::clone(&stop),
                Arc::clone(&paused),
                event_tx,
            ),
        ];

        Self {
            stop,
            paused,
            handles,
        }
    }

    pub fn pause(&self) {
        self.paused.store(true, Ordering::SeqCst);
    }

    pub fn resume(&self) {
        self.paused.store(false, Ordering::SeqCst);
    }

    pub fn stop(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        for handle in self.handles.drain(..) {
            let _ = handle.join();
        }
    }
}
