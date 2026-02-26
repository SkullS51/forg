import React, { useEffect, useRef } from 'react';

const AudioEngine = ({ trackStructure, volume, overdrive, audioContextRef }) => {
  const oscillatorsRef = useRef([]);
  const gainNodeRef = useRef(null);
  const distortionNodeRef = useRef(null);
  const analyserNodeRef = useRef(null);

  useEffect(() => {
    if (!audioContextRef.current) return;

    const audioContext = audioContextRef.current;

    // Initialize Gain Node
    if (!gainNodeRef.current) {
      gainNodeRef.current = audioContext.createGain();
      gainNodeRef.current.connect(audioContext.destination);
    }
    gainNodeRef.current.gain.value = volume / 10;

    // Initialize Distortion Node
    if (!distortionNodeRef.current) {
      distortionNodeRef.current = audioContext.createWaveShaper();
      distortionNodeRef.current.curve = makeDistortionCurve(400); // Amount of distortion
    }

    // Initialize Analyser Node
    if (!analyserNodeRef.current) {
      analyserNodeRef.current = audioContext.createAnalyser();
      analyserNodeRef.current.fftSize = 256;
      analyserNodeRef.current.smoothingTimeConstant = 0.75;
    }

    // Connect nodes: Oscillators -> Distortion (if overdrive) -> Gain -> Analyser -> Destination
    const outputNode = overdrive ? distortionNodeRef.current : gainNodeRef.current;
    if (overdrive) {
      distortionNodeRef.current.connect(gainNodeRef.current);
    }
    gainNodeRef.current.connect(analyserNodeRef.current);
    analyserNodeRef.current.connect(audioContext.destination);

    // Clear existing oscillators
    oscillatorsRef.current.forEach(osc => {
      osc.stop();
      osc.disconnect();
    });
    oscillatorsRef.current = [];

    if (!trackStructure || !trackStructure.pattern || trackStructure.pattern.length === 0) {
      return;
    }

    const bpm = trackStructure.bpm || 666;
    const interval = (60 / bpm) * 1000 / 4; // 16th notes

    let step = 0;
    const playStep = () => {
      trackStructure.pattern[step].forEach((intensity, instrumentIndex) => {
        if (intensity > 0) {
          const osc = audioContext.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(getFrequency(instrumentIndex), audioContext.currentTime);

          const oscGain = audioContext.createGain();
          oscGain.gain.setValueAtTime(intensity / 255, audioContext.currentTime);

          osc.connect(oscGain);
          oscGain.connect(outputNode);

          osc.start(audioContext.currentTime);
          osc.stop(audioContext.currentTime + 0.1); // Short note
          oscillatorsRef.current.push(osc);
        }
      });

      step = (step + 1) % trackStructure.pattern.length;
    };

    const intervalId = setInterval(playStep, interval);

    return () => {
      clearInterval(intervalId);
      oscillatorsRef.current.forEach(osc => {
        osc.stop();
        osc.disconnect();
      });
      oscillatorsRef.current = [];
      if (gainNodeRef.current) gainNodeRef.current.disconnect();
      if (distortionNodeRef.current) distortionNodeRef.current.disconnect();
      if (analyserNodeRef.current) analyserNodeRef.current.disconnect();
    };
  }, [trackStructure, volume, overdrive, audioContextRef]);

  return null;
};

function makeDistortionCurve(amount) {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100; // Standard sample rate
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = i * 2 / n_samples - 1; // Range [-1, 1]
    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function getFrequency(index) {
  const baseFrequencies = [
    82.41, 110.00, 146.83, 196.00, 246.94, 329.63, 440.00, 587.33 // E2 to D5 (guitar/bass range)
  ];
  return baseFrequencies[index % baseFrequencies.length];
}

export default AudioEngine;
