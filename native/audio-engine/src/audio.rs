use std::collections::VecDeque;

pub const OUTPUT_SAMPLE_RATE: u32 = 48_000;
pub const OUTPUT_CHANNELS: u16 = 1;
pub const CHUNK_MS: u32 = 20;
pub const SAMPLES_PER_CHUNK: usize = (OUTPUT_SAMPLE_RATE as usize * CHUNK_MS as usize) / 1000;

pub fn f32_interleaved_to_mono_i16(input: &[f32], channels: usize) -> Vec<i16> {
    if channels == 0 {
        return Vec::new();
    }

    input
        .chunks(channels)
        .map(|frame| {
            let sum: f32 = frame.iter().copied().sum();
            let mono = (sum / frame.len() as f32).clamp(-1.0, 1.0);
            (mono * i16::MAX as f32).round() as i16
        })
        .collect()
}

pub fn i16_interleaved_to_mono_i16(input: &[i16], channels: usize) -> Vec<i16> {
    if channels == 0 {
        return Vec::new();
    }

    input
        .chunks(channels)
        .map(|frame| {
            let sum: i32 = frame.iter().map(|sample| *sample as i32).sum();
            (sum / frame.len() as i32).clamp(i16::MIN as i32, i16::MAX as i32) as i16
        })
        .collect()
}

pub fn u16_interleaved_to_mono_i16(input: &[u16], channels: usize) -> Vec<i16> {
    if channels == 0 {
        return Vec::new();
    }

    input
        .chunks(channels)
        .map(|frame| {
            let sum: i32 = frame.iter().map(|sample| *sample as i32 - 32_768).sum();
            (sum / frame.len() as i32).clamp(i16::MIN as i32, i16::MAX as i32) as i16
        })
        .collect()
}

pub fn resample_i16_linear(input: &[i16], input_rate: u32, output_rate: u32) -> Vec<i16> {
    if input.is_empty() || input_rate == 0 || input_rate == output_rate {
        return input.to_vec();
    }

    let output_len = ((input.len() as u64 * output_rate as u64) / input_rate as u64).max(1) as usize;
    let ratio = input_rate as f64 / output_rate as f64;
    let mut output = Vec::with_capacity(output_len);

    for index in 0..output_len {
        let source = index as f64 * ratio;
        let left = source.floor() as usize;
        let right = (left + 1).min(input.len() - 1);
        let fraction = source - left as f64;
        let sample = input[left] as f64 * (1.0 - fraction) + input[right] as f64 * fraction;
        output.push(sample.round().clamp(i16::MIN as f64, i16::MAX as f64) as i16);
    }

    output
}

pub fn pcm_i16_to_le_bytes(samples: &[i16]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(samples.len() * 2);
    for sample in samples {
        bytes.extend_from_slice(&sample.to_le_bytes());
    }
    bytes
}

pub fn rms_i16(samples: &[i16]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }

    let sum_squares: f64 = samples
        .iter()
        .map(|sample| {
            let value = *sample as f64;
            value * value
        })
        .sum();

    (sum_squares / samples.len() as f64).sqrt() as f32
}

pub fn peak_i16(samples: &[i16]) -> f32 {
    samples
        .iter()
        .map(|sample| sample.unsigned_abs() as f32)
        .fold(0.0, f32::max)
}

pub struct Chunker {
    buffer: Vec<i16>,
    chunk_samples: usize,
}

impl Chunker {
    pub fn new(chunk_samples: usize) -> Self {
        Self {
            buffer: Vec::with_capacity(chunk_samples * 2),
            chunk_samples,
        }
    }

    pub fn push(&mut self, samples: &[i16]) -> Vec<Vec<i16>> {
        self.buffer.extend_from_slice(samples);
        let mut chunks = Vec::new();

        while self.buffer.len() >= self.chunk_samples {
            let remainder = self.buffer.split_off(self.chunk_samples);
            chunks.push(std::mem::replace(&mut self.buffer, remainder));
        }

        chunks
    }
}

pub struct BoundedPcmBuffer {
    samples: VecDeque<i16>,
    capacity: usize,
    dropped: usize,
}

impl BoundedPcmBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            samples: VecDeque::with_capacity(capacity),
            capacity,
            dropped: 0,
        }
    }

    pub fn push(&mut self, samples: &[i16]) {
        for sample in samples {
            if self.samples.len() == self.capacity {
                self.samples.pop_front();
                self.dropped += 1;
            }
            self.samples.push_back(*sample);
        }
    }

    pub fn len(&self) -> usize {
        self.samples.len()
    }

    pub fn dropped(&self) -> usize {
        self.dropped
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_interleaved_float_to_mono_i16() {
        let samples = f32_interleaved_to_mono_i16(&[1.0, -1.0, 0.5, 0.5], 2);

        assert_eq!(samples, vec![0, 16_384]);
    }

    #[test]
    fn resamples_to_48khz() {
        let input = vec![0_i16; 44_100];
        let output = resample_i16_linear(&input, 44_100, OUTPUT_SAMPLE_RATE);

        assert_eq!(output.len(), OUTPUT_SAMPLE_RATE as usize);
    }

    #[test]
    fn emits_20ms_chunks() {
        let mut chunker = Chunker::new(SAMPLES_PER_CHUNK);
        let chunks = chunker.push(&vec![1_i16; SAMPLES_PER_CHUNK * 2 + 100]);

        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].len(), SAMPLES_PER_CHUNK);
    }

    #[test]
    fn bounded_buffer_drops_oldest_samples() {
        let mut buffer = BoundedPcmBuffer::new(3);
        buffer.push(&[1, 2, 3, 4, 5]);

        assert_eq!(buffer.len(), 3);
        assert_eq!(buffer.dropped(), 2);
    }
}
