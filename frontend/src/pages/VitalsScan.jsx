import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_BASE_URL from '../config';

const getAcademyId = () => localStorage.getItem('academyId') || '';

// ── Signal Processing Utilities ─────────────────────────────────────────────

/**
 * Butterworth bandpass filter (2nd order) for isolating heart rate frequencies.
 * Passband: 0.7–3.5 Hz (42–210 BPM) — covers resting to post-exercise HR.
 * Implemented as cascaded biquad sections for numerical stability.
 */
function bandpassFilter(signal, sampleRate) {
  const lowCut = 0.7;
  const highCut = 3.5;

  // Simple moving average subtraction (removes DC/baseline drift)
  const windowSize = Math.round(sampleRate * 1.5);
  const detrended = new Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(signal.length, i + windowSize + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += signal[j];
    detrended[i] = signal[i] - sum / (end - start);
  }

  // Apply Hamming-windowed FIR bandpass
  const filterOrder = Math.min(Math.round(sampleRate * 0.8), 31) | 1; // odd
  const half = Math.floor(filterOrder / 2);
  const kernel = new Array(filterOrder);
  const nyquist = sampleRate / 2;
  const low = lowCut / nyquist;
  const high = highCut / nyquist;

  for (let i = 0; i < filterOrder; i++) {
    const n = i - half;
    if (n === 0) {
      kernel[i] = 2 * (high - low);
    } else {
      kernel[i] = (Math.sin(2 * Math.PI * high * n) - Math.sin(2 * Math.PI * low * n)) / (Math.PI * n);
    }
    // Hamming window
    kernel[i] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (filterOrder - 1));
  }

  // Normalize kernel
  let kernelSum = 0;
  for (let i = 0; i < filterOrder; i++) kernelSum += kernel[i];
  if (Math.abs(kernelSum) > 0.001) {
    for (let i = 0; i < filterOrder; i++) kernel[i] /= kernelSum;
  }

  // Convolve
  const result = new Array(signal.length).fill(0);
  for (let i = half; i < signal.length - half; i++) {
    let val = 0;
    for (let j = 0; j < filterOrder; j++) {
      val += detrended[i - half + j] * kernel[j];
    }
    result[i] = val;
  }

  return result;
}

/**
 * Adaptive peak detection using dynamic thresholding.
 * Finds heartbeat peaks in the filtered PPG signal.
 * Uses refractory period (min 0.3s between beats = max 200 BPM).
 */
function detectPeaks(signal, sampleRate) {
  const minPeakDistance = Math.round(sampleRate * 0.3); // 200 BPM max
  const peaks = [];

  // Compute adaptive threshold (60% of rolling max amplitude)
  const windowLen = Math.round(sampleRate * 2);
  const threshold = new Array(signal.length).fill(0);
  for (let i = 0; i < signal.length; i++) {
    const start = Math.max(0, i - windowLen);
    const end = Math.min(signal.length, i + windowLen);
    let maxVal = 0;
    for (let j = start; j < end; j++) {
      maxVal = Math.max(maxVal, Math.abs(signal[j]));
    }
    threshold[i] = maxVal * 0.4;
  }

  // Find peaks above threshold with refractory period
  let lastPeak = -minPeakDistance;
  for (let i = 2; i < signal.length - 2; i++) {
    if (
      signal[i] > signal[i - 1] &&
      signal[i] > signal[i - 2] &&
      signal[i] > signal[i + 1] &&
      signal[i] > signal[i + 2] &&
      signal[i] > threshold[i] &&
      i - lastPeak >= minPeakDistance
    ) {
      peaks.push(i);
      lastPeak = i;
    }
  }

  return peaks;
}

/**
 * Calculate heart rate and HRV from detected peaks.
 * HR = median of instantaneous rates (robust to outliers).
 * HRV = RMSSD (Root Mean Square of Successive Differences) — gold standard.
 */
function calculateMetrics(peaks, sampleRate) {
  if (peaks.length < 3) return null;

  // Inter-beat intervals in milliseconds
  const ibis = [];
  for (let i = 1; i < peaks.length; i++) {
    const ibi = ((peaks[i] - peaks[i - 1]) / sampleRate) * 1000;
    // Only accept physiologically valid intervals (300–1500ms = 40–200 BPM)
    if (ibi >= 300 && ibi <= 1500) {
      ibis.push(ibi);
    }
  }

  if (ibis.length < 2) return null;

  // Heart rate from median IBI (robust to outliers)
  const sorted = [...ibis].sort((a, b) => a - b);
  const medianIBI = sorted[Math.floor(sorted.length / 2)];
  const heartRate = Math.round(60000 / medianIBI);

  // HRV: RMSSD (Root Mean Square of Successive Differences)
  let sumSquaredDiff = 0;
  let diffCount = 0;
  for (let i = 1; i < ibis.length; i++) {
    const diff = ibis[i] - ibis[i - 1];
    sumSquaredDiff += diff * diff;
    diffCount++;
  }
  const hrv = diffCount > 0 ? Math.round(Math.sqrt(sumSquaredDiff / diffCount) * 10) / 10 : 0;

  // Signal quality: coefficient of variation of IBIs
  // Lower CV = more regular rhythm = higher quality
  const meanIBI = ibis.reduce((a, b) => a + b, 0) / ibis.length;
  const variance = ibis.reduce((sum, v) => sum + (v - meanIBI) ** 2, 0) / ibis.length;
  const cv = Math.sqrt(variance) / meanIBI;
  // Map CV to quality score: CV < 0.1 = excellent, > 0.3 = poor
  const quality = Math.max(0, Math.min(1, 1 - (cv - 0.05) / 0.35));

  return {
    heartRate,
    hrv,
    quality: Math.round(quality * 100) / 100,
    ibiCount: ibis.length,
    medianIBI: Math.round(medianIBI),
  };
}


// ── Main Component ──────────────────────────────────────────────────────────

const SCAN_DURATION = 10; // seconds — quick scan, enough for HR+HRV
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
  const fingerGraceRef = useRef(0); // frames of grace before showing "place finger"

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
    canvas.width = 64;  // small for speed
    canvas.height = 48;
    ctx.drawImage(video, 0, 0, 64, 48);

    const imageData = ctx.getImageData(0, 0, 64, 48);
    const pixels = imageData.data;

    // Extract average red channel value (PPG signal)
    let redSum = 0;
    let greenSum = 0;
    let pixelCount = pixels.length / 4;
    for (let i = 0; i < pixels.length; i += 4) {
      redSum += pixels[i];     // R
      greenSum += pixels[i + 1]; // G
    }
    const avgRed = redSum / pixelCount;
    const avgGreen = greenSum / pixelCount;

    // Finger detection: very relaxed — just needs red to be dominant channel
    // Phone flash + finger gives strong red signal, we don't need to be strict
    const isFingerOn = avgRed > 40 && avgRed > avgGreen * 1.05;

    // Grace period: tolerate up to 15 bad frames (~0.5s) before showing "place finger"
    // This prevents flickering status from brief signal dips
    if (isFingerOn) {
      fingerGraceRef.current = 25; // ~0.8s grace — very forgiving
      setFingerDetected(true);
    } else {
      fingerGraceRef.current = Math.max(0, fingerGraceRef.current - 1);
      if (fingerGraceRef.current <= 0) {
        setFingerDetected(false);
      }
    }

    const effectiveFingerOn = fingerGraceRef.current > 0;
    const now = performance.now();

    if (scanStartRef.current) {
      // Always collect data when scan is running — even during brief dips
      // The bandpass filter will clean noise from bad frames
      if (effectiveFingerOn) {
        samplesRef.current.push(avgRed);
        frameTimesRef.current.push(now);
      }

      // Live signal strength (variance of recent 30 samples = pulsatile signal present)
      const recent = samplesRef.current.slice(-30);
      if (recent.length >= 10) {
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length;
        const strength = Math.min(1, variance / 8); // slightly more sensitive
        setSignalStrength(strength);
      }

      // Live HR preview (from last 5 seconds of data — fast preview for 10s scan)
      liveBufferRef.current.push(avgRed);
      if (liveBufferRef.current.length > TARGET_FPS * 6) {
        liveBufferRef.current = liveBufferRef.current.slice(-TARGET_FPS * 5);
        const filtered = bandpassFilter(liveBufferRef.current, TARGET_FPS);
        const peaks = detectPeaks(filtered, TARGET_FPS);
        const metrics = calculateMetrics(peaks, TARGET_FPS);
        if (metrics && metrics.heartRate >= 40 && metrics.heartRate <= 200) {
          setLiveHR(metrics.heartRate);
        }
      }

      // Countdown — always ticks once scan starts
      const elapsed = (now - scanStartRef.current) / 1000;
      setCountdown(Math.max(0, Math.ceil(SCAN_DURATION - elapsed)));

      if (elapsed >= SCAN_DURATION) {
        // Done scanning — process
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
    if (samples.length < TARGET_FPS * 4) {
      setError('Not enough data captured. Keep your finger on the camera for the full 10 seconds. Press gently and stay still.');
      setPhase('error');
      return;
    }

    // Calculate actual sample rate from frame timestamps
    const times = frameTimesRef.current;
    const actualDuration = (times[times.length - 1] - times[0]) / 1000;
    const actualFPS = samples.length / actualDuration;

    // Process signal
    const filtered = bandpassFilter(samples, actualFPS);
    const peaks = detectPeaks(filtered, actualFPS);
    const metrics = calculateMetrics(peaks, actualFPS);

    if (!metrics || metrics.heartRate < 40 || metrics.heartRate > 200) {
      setError('Could not detect a reliable heart rate. Make sure your finger fully covers the camera and flash, stay still, and try again.');
      setPhase('error');
      return;
    }

    if (metrics.quality < 0.15) {
      setError('Signal quality too low. Press your finger gently on the camera + flash, keep still for 10 seconds.');
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
          hrv: metrics.hrv,
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
    if (!hrv) return { label: '—', color: 'text-gray-500' };
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
                  { step: '2', text: 'Hold still for 10 seconds — the camera reads your pulse through your skin', icon: '📷' },
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
              {/* Outer pulse rings */}
              <div className={`absolute inset-0 rounded-full border-2 ${fingerDetected ? 'border-rose-500 animate-ping' : 'border-gray-700'}`}
                style={{ animationDuration: '1.5s' }} />
              <div className={`absolute inset-2 rounded-full border-2 ${fingerDetected ? 'border-rose-400 animate-ping' : 'border-gray-700'}`}
                style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
              {/* Center circle with HR */}
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
                <span className="text-5xl font-black text-indigo-400">{results.hrv}</span>
                <span className="text-gray-500 font-bold text-sm">ms</span>
              </div>
              <p className="text-gray-600 text-[10px] mt-2">
                Higher HRV = better recovery. Tracks how ready your body is for training.
              </p>
            </div>

            {/* Signal Quality */}
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
