import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';

const getAcademyId = () => localStorage.getItem('academyId') || '';

// ── Signal Processing Utilities ─────────────────────────────────────────────

/**
 * Cooley-Tukey radix-2 FFT (in-place, iterative).
 * Accepts real-valued signal, returns magnitude spectrum.
 * Input length is zero-padded to next power of 2.
 */
function fft(signal) {
  // Pad to next power of 2
  let n = 1;
  while (n < signal.length) n <<= 1;

  // Build complex arrays (real, imag)
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < signal.length; i++) re[i] = signal[i];

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) { j -= m; m >>= 1; }
    j += m;
  }

  // FFT butterfly
  for (let size = 2; size <= n; size <<= 1) {
    const halfSize = size >> 1;
    const angle = -2 * Math.PI / size;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let i = 0; i < n; i += size) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < halfSize; k++) {
        const tRe = curRe * re[i + k + halfSize] - curIm * im[i + k + halfSize];
        const tIm = curRe * im[i + k + halfSize] + curIm * re[i + k + halfSize];
        re[i + k + halfSize] = re[i + k] - tRe;
        im[i + k + halfSize] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
        const newCurRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newCurRe;
      }
    }
  }

  // Magnitude spectrum (only first half — symmetric)
  const mag = new Float64Array(n >> 1);
  for (let i = 0; i < mag.length; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }

  return { mag, n };
}

/**
 * Hann window — reduces spectral leakage for cleaner FFT peaks.
 */
function hannWindow(signal) {
  const n = signal.length;
  const windowed = new Array(n);
  for (let i = 0; i < n; i++) {
    windowed[i] = signal[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
  }
  return windowed;
}

/**
 * Remove linear trend (detrend) from signal.
 */
function detrend(signal) {
  const n = signal.length;
  if (n < 2) return signal;
  const first = signal[0];
  const last = signal[n - 1];
  const slope = (last - first) / (n - 1);
  return signal.map((v, i) => v - (first + slope * i));
}

/**
 * Parabolic interpolation around FFT peak for sub-bin frequency accuracy.
 * Refines the peak position between discrete FFT bins.
 */
function parabolicInterp(mag, peakIdx) {
  if (peakIdx <= 0 || peakIdx >= mag.length - 1) return peakIdx;
  const alpha = mag[peakIdx - 1];
  const beta = mag[peakIdx];
  const gamma = mag[peakIdx + 1];
  const denom = alpha - 2 * beta + gamma;
  if (Math.abs(denom) < 1e-10) return peakIdx;
  const p = 0.5 * (alpha - gamma) / denom;
  return peakIdx + p;
}

/**
 * FFT-based heart rate detection with harmonic correction.
 * Finds dominant frequency in 0.75–3.33 Hz band (45–200 BPM).
 * Detects sub-harmonic trap: if the peak is below 55 BPM, checks if the
 * 2x harmonic is strong — if so, the real HR is the harmonic (doubled).
 */
function fftHeartRate(signal, sampleRate) {
  // Detrend → Hann window → FFT
  const detrended = detrend(signal);
  const windowed = hannWindow(detrended);
  const { mag, n } = fft(windowed);

  const freqResolution = sampleRate / n;

  // HR band: 0.75–3.33 Hz (45–200 BPM)
  const minBin = Math.ceil(0.75 / freqResolution);
  const maxBin = Math.floor(3.33 / freqResolution);

  if (minBin >= maxBin || maxBin >= mag.length) return null;

  // Find top 3 peaks in the band for harmonic analysis
  const peaks = [];
  for (let i = minBin + 1; i < maxBin; i++) {
    if (mag[i] > mag[i - 1] && mag[i] > mag[i + 1]) {
      peaks.push({ idx: i, val: mag[i] });
    }
  }
  peaks.sort((a, b) => b.val - a.val);

  if (peaks.length === 0) return null;

  let peakIdx = peaks[0].idx;
  let peakVal = peaks[0].val;

  // Band average for SNR
  let bandSum = 0;
  let bandCount = 0;
  for (let i = minBin; i <= maxBin; i++) {
    bandSum += mag[i];
    bandCount++;
  }

  if (peakVal < 1e-6) return null;

  // ── Harmonic correction ──
  // If dominant peak is below 55 BPM (sub-harmonic territory),
  // check if 2x that frequency has a strong peak — if so, use it.
  const peakFreqRaw = peakIdx * freqResolution;
  const peakBPM = peakFreqRaw * 60;

  if (peakBPM < 55) {
    const harmonicBin = Math.round(peakIdx * 2);
    if (harmonicBin < mag.length) {
      // Check a ±2 bin window around the expected harmonic
      let harmonicMax = 0;
      let harmonicIdx = harmonicBin;
      for (let i = Math.max(minBin, harmonicBin - 2); i <= Math.min(maxBin, harmonicBin + 2); i++) {
        if (mag[i] > harmonicMax) {
          harmonicMax = mag[i];
          harmonicIdx = i;
        }
      }
      // Use harmonic if it's at least 30% of the sub-harmonic peak strength
      // Sub-harmonics are often stronger than the fundamental in PPG
      if (harmonicMax > peakVal * 0.3) {
        peakIdx = harmonicIdx;
        peakVal = harmonicMax;
      }
    }
  }

  // Also check: if peak is in 55-75 BPM range, see if 2x harmonic is
  // actually stronger or comparable — PPG can pick up half-rate artifacts
  if (peakBPM >= 55 && peakBPM < 75) {
    const harmonicBin = Math.round(peakIdx * 2);
    if (harmonicBin < mag.length && harmonicBin <= maxBin) {
      let harmonicMax = 0;
      let harmonicIdx = harmonicBin;
      for (let i = Math.max(minBin, harmonicBin - 2); i <= Math.min(maxBin, harmonicBin + 2); i++) {
        if (mag[i] > harmonicMax) {
          harmonicMax = mag[i];
          harmonicIdx = i;
        }
      }
      // Only switch if harmonic is stronger (real HR is at the harmonic)
      if (harmonicMax > peakVal * 0.8) {
        peakIdx = harmonicIdx;
        peakVal = harmonicMax;
      }
    }
  }

  // Parabolic interpolation for sub-bin accuracy
  const refinedIdx = parabolicInterp(mag, peakIdx);
  const peakFreq = refinedIdx * freqResolution;
  const heartRate = Math.round(peakFreq * 60);

  // Reject physiologically impossible values
  if (heartRate < 45 || heartRate > 200) return null;

  // SNR: peak vs average band magnitude
  const bandAvg = bandSum / bandCount;
  const snr = bandAvg > 0 ? peakVal / bandAvg : 0;
  // Map SNR to quality: snr 3+ = excellent, snr 1.5 = marginal
  const quality = Math.max(0, Math.min(1, (snr - 1.2) / 4));

  return { heartRate, quality, snr, peakFreq };
}

/**
 * Adaptive peak detection for HRV calculation (time-domain).
 * Only used for RMSSD — FFT handles the HR.
 * Uses FFT-derived HR to set expected peak spacing for guided detection.
 */
function detectPeaks(signal, sampleRate, expectedHR) {
  // Simple moving average subtraction (detrend)
  const windowSize = Math.round(sampleRate * 1.5);
  const detrended = new Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(signal.length, i + windowSize + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += signal[j];
    detrended[i] = signal[i] - sum / (end - start);
  }

  // Use expected HR to set min peak distance (allow 40% faster than expected)
  const expectedInterval = expectedHR ? (60 / expectedHR) * sampleRate : sampleRate * 0.3;
  const minPeakDistance = Math.round(expectedInterval * 0.6);
  const peaks = [];

  // Adaptive threshold — lower to 25% to catch more peaks (outlier rejection handles noise)
  const windowLen = Math.round(sampleRate * 2);
  const threshold = new Array(signal.length).fill(0);
  for (let i = 0; i < signal.length; i++) {
    const start = Math.max(0, i - windowLen);
    const end = Math.min(signal.length, i + windowLen);
    let maxVal = 0;
    for (let j = start; j < end; j++) {
      maxVal = Math.max(maxVal, Math.abs(detrended[j]));
    }
    threshold[i] = maxVal * 0.25;
  }

  let lastPeak = -minPeakDistance;
  for (let i = 2; i < detrended.length - 2; i++) {
    if (
      detrended[i] > detrended[i - 1] &&
      detrended[i] > detrended[i + 1] &&
      detrended[i] > threshold[i] &&
      i - lastPeak >= minPeakDistance
    ) {
      peaks.push(i);
      lastPeak = i;
    }
  }

  return peaks;
}

/**
 * Calculate HRV (RMSSD) from detected peaks.
 * Uses median-based IBI outlier rejection to prevent noise from inflating HRV.
 * Caps RMSSD at 150ms (physiological maximum for healthy athletes).
 */
function calculateHRV(peaks, sampleRate) {
  if (peaks.length < 4) return null;

  // Collect raw IBIs
  const rawIbis = [];
  for (let i = 1; i < peaks.length; i++) {
    const ibi = ((peaks[i] - peaks[i - 1]) / sampleRate) * 1000;
    if (ibi >= 300 && ibi <= 1500) rawIbis.push(ibi);
  }

  if (rawIbis.length < 3) return null;

  // Median-based outlier rejection: remove IBIs deviating >35% from median
  const sorted = [...rawIbis].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const ibis = rawIbis.filter(ibi => Math.abs(ibi - median) / median <= 0.35);

  if (ibis.length < 3) return null;

  // RMSSD: Root Mean Square of Successive Differences
  let sumSquaredDiff = 0;
  let diffCount = 0;
  for (let i = 1; i < ibis.length; i++) {
    const diff = ibis[i] - ibis[i - 1];
    sumSquaredDiff += diff * diff;
    diffCount++;
  }

  if (diffCount === 0) return null;

  let rmssd = Math.sqrt(sumSquaredDiff / diffCount);

  // Cap at 150ms — physiological ceiling for even elite athletes
  rmssd = Math.min(150, rmssd);

  return Math.round(rmssd * 10) / 10;
}

/**
 * Main signal processing pipeline.
 * FFT for HR (robust), peak detection for HRV (needs IBI).
 * Auto-retries with middle 60% of signal on failure.
 */
function processSignal(samples, sampleRate) {
  // First pass: full signal
  let result = _processPass(samples, sampleRate);
  if (result) return result;

  // Auto-retry: trim noisy start/end, use middle 60%
  const trimStart = Math.floor(samples.length * 0.2);
  const trimEnd = Math.floor(samples.length * 0.8);
  const trimmed = samples.slice(trimStart, trimEnd);
  if (trimmed.length < sampleRate * 3) return null;

  return _processPass(trimmed, sampleRate);
}

function _processPass(samples, sampleRate) {
  // FFT-based heart rate
  const fftResult = fftHeartRate(samples, sampleRate);
  if (!fftResult) return null;

  // Peak-based HR + HRV — pass FFT HR to guide peak spacing
  const peaks = detectPeaks(samples, sampleRate, fftResult.heartRate);
  let peakHR = null;

  if (peaks.length >= 4) {
    const ibis = [];
    for (let i = 1; i < peaks.length; i++) {
      const ibi = ((peaks[i] - peaks[i - 1]) / sampleRate) * 1000;
      if (ibi >= 300 && ibi <= 1500) ibis.push(ibi);
    }
    if (ibis.length >= 3) {
      const sorted = [...ibis].sort((a, b) => a - b);
      const medianIBI = sorted[Math.floor(sorted.length / 2)];
      peakHR = Math.round(60000 / medianIBI);
    }
  }

  // Cross-validate: if both FFT and peak HR exist, use the one in the
  // more physiologically likely range. If they agree (within 15%), trust FFT.
  let finalHR = fftResult.heartRate;
  let crossValidated = false;

  if (peakHR && peakHR >= 45 && peakHR <= 200) {
    const diff = Math.abs(fftResult.heartRate - peakHR) / peakHR;
    if (diff <= 0.15) {
      // Both methods agree — high confidence, use FFT (more precise)
      crossValidated = true;
    } else if (fftResult.heartRate < 55 && peakHR >= 55) {
      // FFT likely caught sub-harmonic, peak-based is more trustworthy
      finalHR = peakHR;
    } else if (peakHR < 55 && fftResult.heartRate >= 55) {
      // Peak detection missed beats, FFT is better
      finalHR = fftResult.heartRate;
    } else {
      // Disagreement — use whichever is closer to 60-100 BPM (resting range)
      const fftDist = Math.min(Math.abs(fftResult.heartRate - 60), Math.abs(fftResult.heartRate - 100));
      const peakDist = Math.min(Math.abs(peakHR - 60), Math.abs(peakHR - 100));
      finalHR = fftDist <= peakDist ? fftResult.heartRate : peakHR;
    }
  }

  if (finalHR < 45 || finalHR > 200) return null;

  // HRV from peaks
  const hrv = calculateHRV(peaks, sampleRate);

  // Accuracy estimate
  const snrScore = Math.min(40, (fftResult.snr - 1) * 10);
  const qualityScore = fftResult.quality * 30;
  const expectedSamples = sampleRate * SCAN_DURATION;
  const dataScore = Math.min(20, (samples.length / expectedSamples) * 20);
  // Cross-validation bonus: both methods agreeing = much higher confidence
  const validationBonus = crossValidated ? 10 : (hrv != null ? 5 : 0);
  const accuracy = Math.min(99, Math.max(30, Math.round(snrScore + qualityScore + dataScore + validationBonus)));

  return {
    heartRate: finalHR,
    hrv: hrv != null ? hrv : null,
    quality: fftResult.quality,
    snr: fftResult.snr,
    accuracy,
  };
}


// ── Main Component ──────────────────────────────────────────────────────────

const SCAN_DURATION = 15; // seconds
const TARGET_FPS = 30;

export default function VitalsScan() {
  const navigate = useNavigate();
  const athleteName = (localStorage.getItem('athleteName') || '').trim();
  const academyId = getAcademyId();

  // States
  const [phase, setPhase] = useState('intro'); // intro | scanning | processing | results | error
  const [countdown, setCountdown] = useState(SCAN_DURATION);
  const [fingerDetected, setFingerDetected] = useState(false);
  const [liveHR, setLiveHR] = useState(null);
  const [signalStrength, setSignalStrength] = useState(0);
  const [results, setResults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [error, setError] = useState('');

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const samplesRef = useRef([]);
  const frameTimesRef = useRef([]);
  const animFrameRef = useRef(null);
  const scanStartRef = useRef(null);
  const liveBufferRef = useRef([]);
  const fingerGraceRef = useRef(0);

  // Check if already submitted today
  useEffect(() => {
    if (!athleteName) { navigate('/login'); return; }
    const checkToday = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/vitals/today/${encodeURIComponent(athleteName)}`,
          { params: { academy_id: academyId } }
        );
        if (res.data.submitted) {
          setAlreadyDone(true);
          setResults({
            heartRate: res.data.data.heart_rate,
            hrv: res.data.data.hrv,
            quality: res.data.data.signal_quality,
          });
          setPhase('results');
        }
      } catch { /* ignore */ }
    };
    checkToday();
  }, [athleteName, academyId, navigate]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: TARGET_FPS },
        },
      });

      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      // Enable torch (flash) for consistent illumination
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.();
      if (capabilities?.torch) {
        await track.applyConstraints({ advanced: [{ torch: true }] });
      }

      return true;
    } catch (err) {
      console.error('Camera access failed:', err);
      setError('Camera access denied. Please allow camera permission and try again.');
      setPhase('error');
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = 64;
    canvas.height = 48;
    ctx.drawImage(video, 0, 0, 64, 48);

    const imageData = ctx.getImageData(0, 0, 64, 48);
    const pixels = imageData.data;

    let redSum = 0;
    let greenSum = 0;
    const pixelCount = pixels.length / 4;
    for (let i = 0; i < pixels.length; i += 4) {
      redSum += pixels[i];
      greenSum += pixels[i + 1];
    }
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;

    // Finger detection — just a UI hint, NOT a gate for data collection
    const isFingerOn = avgRed > 35 && avgRed > avgGreen;

    if (isFingerOn) {
      fingerGraceRef.current = 25;
      setFingerDetected(true);
    } else {
      fingerGraceRef.current = Math.max(0, fingerGraceRef.current - 1);
      if (fingerGraceRef.current <= 0) {
        setFingerDetected(false);
      }
    }

    const now = performance.now();

    if (scanStartRef.current) {
      // ALWAYS collect frames — FFT filters out noise from bad frames
      samplesRef.current.push(avgRed);
      frameTimesRef.current.push(now);

      // Live signal strength
      const recent = samplesRef.current.slice(-30);
      if (recent.length >= 10) {
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length;
        setSignalStrength(Math.min(1, variance / 6));
      }

      // Live HR preview via FFT (every ~2 seconds once we have 5s+ of data)
      liveBufferRef.current.push(avgRed);
      if (liveBufferRef.current.length > TARGET_FPS * 6 && liveBufferRef.current.length % (TARGET_FPS * 2) < 2) {
        const buf = liveBufferRef.current.slice(-TARGET_FPS * 5);
        const fftResult = fftHeartRate(buf, TARGET_FPS);
        if (fftResult && fftResult.heartRate >= 40 && fftResult.heartRate <= 200 && fftResult.quality > 0.05) {
          setLiveHR(fftResult.heartRate);
        }
      }

      // Countdown
      const elapsed = (now - scanStartRef.current) / 1000;
      setCountdown(Math.max(0, Math.ceil(SCAN_DURATION - elapsed)));

      if (elapsed >= SCAN_DURATION) {
        finishScan();
        return;
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  const startScan = useCallback(async () => {
    samplesRef.current = [];
    frameTimesRef.current = [];
    liveBufferRef.current = [];
    fingerGraceRef.current = 0;
    setCountdown(SCAN_DURATION);
    setLiveHR(null);
    setSignalStrength(0);
    setFingerDetected(false);
    setPhase('scanning');

    const ok = await startCamera();
    if (!ok) return;

    scanStartRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [startCamera, processFrame]);

  const finishScan = useCallback(() => {
    stopCamera();
    setPhase('processing');

    const samples = samplesRef.current;
    const times = frameTimesRef.current;

    if (samples.length < TARGET_FPS * 3) {
      setError('Not enough data captured. Keep your finger on the camera for the full scan. Press gently and stay still.');
      setPhase('error');
      return;
    }

    // Calculate actual sample rate from frame timestamps
    const actualDuration = (times[times.length - 1] - times[0]) / 1000;
    const actualFPS = samples.length / actualDuration;

    // Process with FFT + auto-retry
    const metrics = processSignal(samples, actualFPS);

    if (!metrics) {
      setError('Could not detect a reliable heart rate. Make sure your finger fully covers the camera and flash, stay still, and try again.');
      setPhase('error');
      return;
    }

    if (metrics.quality < 0.08) {
      setError('Signal quality too low. Press your finger gently on the camera + flash, keep still for the full 12 seconds.');
      setPhase('error');
      return;
    }

    setResults(metrics);
    setPhase('results');
    saveVitals(metrics);
  }, [stopCamera]);

  const saveVitals = async (metrics) => {
    setSaving(true);
    try {
      await axios.post(
        `${API_BASE_URL}/vitals?academy_id=${academyId}`,
        {
          athlete_name: athleteName,
          heart_rate: metrics.heartRate,
          hrv: metrics.hrv != null ? metrics.hrv : 0,
          signal_quality: metrics.quality,
        }
      );
    } catch (err) {
      console.error('Failed to save vitals:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = () => {
    setError('');
    setResults(null);
    setPhase('intro');
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────

  const getHRZone = (hr) => {
    if (!hr) return { label: '—', color: 'text-gray-500' };
    if (hr < 60) return { label: 'Resting', color: 'text-blue-400' };
    if (hr < 80) return { label: 'Normal', color: 'text-emerald-400' };
    if (hr < 100) return { label: 'Elevated', color: 'text-amber-400' };
    return { label: 'High', color: 'text-rose-400' };
  };

  const getHRVStatus = (hrv) => {
    if (hrv == null || hrv === '—') return { label: '—', color: 'text-gray-500' };
    if (hrv >= 50) return { label: 'Excellent Recovery', color: 'text-emerald-400' };
    if (hrv >= 30) return { label: 'Good Recovery', color: 'text-blue-400' };
    if (hrv >= 20) return { label: 'Moderate', color: 'text-amber-400' };
    return { label: 'Low — Fatigued', color: 'text-rose-400' };
  };

  const getQualityLabel = (q) => {
    if (q >= 0.8) return { label: 'Excellent', color: 'text-emerald-400' };
    if (q >= 0.6) return { label: 'Good', color: 'text-blue-400' };
    if (q >= 0.4) return { label: 'Fair', color: 'text-amber-400' };
    return { label: 'Low', color: 'text-rose-400' };
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Hidden video + canvas for camera processing */}
        <video ref={videoRef} playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="hidden" />

        {/* ── INTRO ── */}
        {phase === 'intro' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">❤️</span>
            </div>
            <h1 className="text-2xl font-black mb-2">Vitals Scan</h1>
            <p className="text-gray-500 text-sm mb-8">
              Measure your heart rate & recovery in just {SCAN_DURATION} seconds
            </p>

            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 mb-6 text-left">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">How it works</p>
              <div className="space-y-4">
                {[
                  { step: '1', text: 'Place your fingertip gently over the rear camera and flash', icon: '👆' },
                  { step: '2', text: `Hold still for ${SCAN_DURATION} seconds — the camera reads your pulse through your skin`, icon: '📷' },
                  { step: '3', text: 'Get your Heart Rate + HRV (recovery score) instantly', icon: '📊' },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-3">
                    <span className="text-lg">{s.icon}</span>
                    <div>
                      <p className="text-white text-sm font-bold">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={startScan}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg shadow-rose-600/20">
              Start Scan
            </button>

            <div className="flex gap-2 mt-4">
              <button onClick={() => navigate('/checkin')}
                className="flex-1 border border-gray-700 text-gray-500 py-2.5 rounded-xl text-xs font-bold hover:border-gray-600 transition">
                ← Check-in
              </button>
              <button onClick={() => navigate('/athlete-dashboard')}
                className="flex-1 border border-gray-700 text-gray-500 py-2.5 rounded-xl text-xs font-bold hover:border-gray-600 transition">
                Dashboard
              </button>
            </div>
          </div>
        )}

        {/* ── SCANNING ── */}
        {phase === 'scanning' && (
          <div className="text-center">
            {/* Pulse animation ring */}
            <div className="relative w-40 h-40 mx-auto mb-8">
              <div className={`absolute inset-0 rounded-full border-2 ${fingerDetected ? 'border-rose-500 animate-ping' : 'border-gray-700'}`}
                style={{ animationDuration: '1.5s' }} />
              <div className={`absolute inset-2 rounded-full border-2 ${fingerDetected ? 'border-rose-400 animate-ping' : 'border-gray-700'}`}
                style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
              <div className={`absolute inset-4 rounded-full flex flex-col items-center justify-center ${
                fingerDetected ? 'bg-rose-500/20 border-2 border-rose-500/50' : 'bg-gray-800 border-2 border-gray-700'
              }`}>
                {fingerDetected && liveHR ? (
                  <>
                    <span className="text-4xl font-black text-rose-400">{liveHR}</span>
                    <span className="text-[10px] font-bold text-rose-400/60 uppercase">BPM</span>
                  </>
                ) : (
                  <span className="text-gray-600 text-xs font-bold text-center px-2">
                    {fingerDetected ? 'Detecting...' : 'Place finger'}
                  </span>
                )}
              </div>
            </div>

            {/* Finger detection status */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${
              fingerDetected
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse'
            }`}>
              <span className={`w-2 h-2 rounded-full ${fingerDetected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-xs font-black uppercase tracking-wider">
                {fingerDetected ? 'Finger detected — scanning' : 'Place finger on camera'}
              </span>
            </div>

            {/* Countdown */}
            <div className="mb-4">
              <p className="text-5xl font-black text-white mb-1">{countdown}<span className="text-lg text-gray-600">s</span></p>
              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${((SCAN_DURATION - countdown) / SCAN_DURATION) * 100}%` }} />
              </div>
            </div>

            {/* Signal strength */}
            {fingerDetected && (
              <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] font-bold text-gray-600 uppercase">Signal</span>
                <div className="flex gap-0.5">
                  {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, i) => (
                    <div key={i} className={`w-2 rounded-sm transition-all ${
                      signalStrength >= threshold ? 'bg-emerald-400' : 'bg-gray-700'
                    }`} style={{ height: `${8 + i * 3}px` }} />
                  ))}
                </div>
              </div>
            )}

            <p className="text-gray-600 text-xs mt-6">Keep your finger still and press gently</p>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {phase === 'processing' && (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-black mb-2">Analyzing Signal</h2>
            <p className="text-gray-500 text-sm">Processing {samplesRef.current.length} data points...</p>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === 'results' && results && (
          <div>
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">✅</div>
              <h2 className="text-2xl font-black">
                {alreadyDone ? "Today's Vitals" : 'Scan Complete'}
              </h2>
              <p className="text-gray-500 text-xs mt-1">
                {alreadyDone ? 'Already submitted today' : 'Your vitals have been recorded'}
              </p>
            </div>

            {/* Heart Rate Card */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Heart Rate</p>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                  getHRZone(results.heartRate).color
                } bg-gray-900 border-gray-700`}>
                  {getHRZone(results.heartRate).label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-rose-400">{results.heartRate}</span>
                <span className="text-gray-500 font-bold text-sm">BPM</span>
              </div>
            </div>

            {/* HRV Card */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">HRV</p>
                  <span className="text-[9px] text-gray-600 font-bold">(Recovery Index)</span>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                  getHRVStatus(results.hrv).color
                } bg-gray-900 border-gray-700`}>
                  {getHRVStatus(results.hrv).label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-indigo-400">{results.hrv != null ? results.hrv : '—'}</span>
                <span className="text-gray-500 font-bold text-sm">{results.hrv != null ? 'ms' : ''}</span>
              </div>
              <p className="text-gray-600 text-[10px] mt-2">
                {results.hrv != null
                  ? 'Higher HRV = better recovery. Tracks how ready your body is for training.'
                  : 'HRV could not be measured this scan. Try holding steadier next time.'}
              </p>
            </div>

            {/* Accuracy + Signal Quality */}
            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Estimated Accuracy</p>
                <span className={`text-sm font-black ${
                  results.accuracy >= 80 ? 'text-emerald-400' : results.accuracy >= 60 ? 'text-blue-400' : results.accuracy >= 45 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {results.accuracy >= 80 ? 'High' : results.accuracy >= 60 ? 'Moderate' : results.accuracy >= 45 ? 'Fair' : 'Low'}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-4xl font-black ${
                  results.accuracy >= 80 ? 'text-emerald-400' : results.accuracy >= 60 ? 'text-blue-400' : results.accuracy >= 45 ? 'text-amber-400' : 'text-rose-400'
                }`}>{results.accuracy}</span>
                <span className="text-gray-500 font-bold text-sm">%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${
                  results.accuracy >= 80 ? 'bg-emerald-500' : results.accuracy >= 60 ? 'bg-blue-500' : results.accuracy >= 45 ? 'bg-amber-500' : 'bg-rose-500'
                }`} style={{ width: `${results.accuracy}%` }} />
              </div>
              <p className="text-gray-600 text-[10px] mt-2">
                Based on signal strength, data quality, and scan completeness.
                {results.accuracy < 60 ? ' Try again in a darker environment with steady finger pressure.' : ''}
              </p>
            </div>

            {/* Signal Quality (smaller, below accuracy) */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 mb-6">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Signal Quality</p>
                <span className={`text-sm font-black ${getQualityLabel(results.quality).color}`}>
                  {getQualityLabel(results.quality).label} ({Math.round(results.quality * 100)}%)
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${
                  results.quality >= 0.8 ? 'bg-emerald-500' : results.quality >= 0.6 ? 'bg-blue-500' : 'bg-amber-500'
                }`} style={{ width: `${results.quality * 100}%` }} />
              </div>
            </div>

            {saving && (
              <p className="text-gray-600 text-xs text-center mb-4 animate-pulse">Saving to your profile...</p>
            )}

            <div className="flex gap-2">
              <button onClick={() => navigate('/checkin')}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black text-sm transition-all">
                Continue to Check-in →
              </button>
              <button onClick={() => navigate('/athlete-dashboard')}
                className="flex-1 border border-gray-700 text-gray-400 py-3 rounded-xl font-bold text-sm hover:border-gray-600 transition">
                Dashboard
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === 'error' && (
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-black mb-2">Scan Failed</h2>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">{error}</p>

            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 mb-6 text-left">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Tips for a good scan</p>
              <ul className="space-y-2 text-gray-400 text-xs">
                <li className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">✓</span> Cover both the camera lens AND flash completely</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">✓</span> Press gently — too hard blocks blood flow</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">✓</span> Stay completely still during the scan</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">✓</span> Avoid scanning in bright sunlight</li>
              </ul>
            </div>

            <button onClick={handleRetry}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-xl font-black text-sm transition-all">
              Try Again
            </button>
            <button onClick={() => navigate('/checkin')}
              className="w-full text-gray-600 hover:text-gray-400 text-xs font-bold mt-3 py-2 transition">
              Skip and go to Check-in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
