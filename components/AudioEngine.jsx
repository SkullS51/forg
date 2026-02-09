
import React, { useEffect, useRef, useCallback } from 'react';
// Removed specific type imports from '../types' as they are now used implicitly for runtime.

const AudioEngine = ({ structure, volume, isPlaying, currentPrompt, audioContext, overdrive, chaosMode }) => {
  const nextNoteTimeRef = useRef(0);
  const timerIDRef = useRef(null);
  const currentBeatRef = useRef(0);

  const mainGainRef = useRef(null);
  const distortionRef = useRef(null);
  
  const structureRef = useRef(structure);
  const volumeRef = useRef(volume);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => { structureRef.current = structure; }, [structure]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    volumeRef.current = volume;
    if (mainGainRef.current && audioContext) {
      mainGainRef.current.gain.setTargetAtTime(volume * (chaosMode ? 40.0 : (overdrive ? 12.0 : 6.0)), audioContext.currentTime, 0.01);
    }
  }, [volume, audioContext, overdrive, chaosMode]);

  const makeDistortionCurve = (amount) => {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      const k = amount;
      const val = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x));
      curve[i] = val > 1 ? 1 : val < -1 ? -1 : val;
    }
    return curve;
  };

  const playOverdriveNote = useCallback((time, freq, velocity) => {
    if (!audioContext || !distortionRef.current || !mainGainRef.current) return;
    const ctx = audioContext;
    const start = Math.max(time, ctx.currentTime + 0.005);

    const carrier = ctx.createOscillator();
    const g = ctx.createGain();

    carrier.type = chaosMode ? 'sawtooth' : 'square';
    const cFreq = chaosMode ? (freq * (0.5 + Math.random() * 5)) : (freq * (overdrive ? 0.25 : 0.5));
    carrier.frequency.setValueAtTime(cFreq, start);
    
    if (chaosMode) {
        carrier.frequency.exponentialRampToValueAtTime(20 + Math.random()*8000, start + 0.1);
    }

    const vNorm = (velocity / 255) * (chaosMode ? 8.0 : (overdrive ? 4.0 : 2.0));
    g.gain.setValueAtTime(vNorm, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + (chaosMode ? 0.8 : 0.3));

    carrier.connect(g);
    g.connect(distortionRef.current);
    carrier.start(start);
    carrier.stop(start + 0.8);

    // KICK / BLAST
    if (currentBeatRef.current % 4 === 0) {
      const kick = ctx.createOscillator();
      const kg = ctx.createGain();
      kick.frequency.setValueAtTime(150, start);
      kick.frequency.exponentialRampToValueAtTime(1, start + 0.1);
      kg.gain.setValueAtTime(chaosMode ? 8.0 : 4.0, start);
      kg.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      kick.connect(kg);
      kg.connect(mainGainRef.current);
      kick.start(start);
      kick.stop(start + 0.4);
    }
  }, [audioContext, overdrive, chaosMode]);

  const scheduler = useCallback(() => {
    if (!audioContext || !isPlayingRef.current) return;
    
    const windowSize = 0.2;
    while (nextNoteTimeRef.current < audioContext.currentTime + windowSize) {
      const idx = currentBeatRef.current % 16;
      const notes = structureRef.current.pattern?.[idx] || [];
      notes.forEach((v, i) => {
        if (v > 0) playOverdriveNote(nextNoteTimeRef.current, 10 + (i * 3) + (v % 60), v);
      });
      const bpm = structureRef.current.bpm || 666;
      nextNoteTimeRef.current += (60.0 / bpm) / 4; 
      currentBeatRef.current++;
    }
    timerIDRef.current = window.setTimeout(scheduler, 25);
  }, [playOverdriveNote, audioContext]);

  useEffect(() => {
    if (isPlaying && audioContext) {
      const init = async () => {
        const dist = audioContext.createWaveShaper();
        dist.curve = makeDistortionCurve(chaosMode ? 8000 : (overdrive ? 2000 : 800));
        distortionRef.current = dist;
        const gain = audioContext.createGain();
        gain.gain.value = volumeRef.current * (chaosMode ? 40.0 : (overdrive ? 12.0 : 6.0));
        mainGainRef.current = gain;
        dist.connect(gain);
        gain.connect(audioContext.destination);
        nextNoteTimeRef.current = audioContext.currentTime + 0.05;
        currentBeatRef.current = 0;
        scheduler();
      };
      init();
    } else {
      if (timerIDRef.current) clearTimeout(timerIDRef.current);
    }
    return () => { if (timerIDRef.current) clearTimeout(timerIDRef.current); };
  }, [isPlaying, scheduler, audioContext, overdrive, chaosMode]);

  return React.createElement(
    "div",
    {
      className: `flex items-center gap-3 md:gap-6 px-4 py-2 md:px-10 md:py-6 border-4 md:border-8 transition-all ${chaosMode ? 'bg-yellow-500 border-white animate-bounce' : overdrive ? 'bg-white border-white' : 'bg-red-950 border-red-600'}`
    },
    React.createElement("div", {
      className: `w-3 h-3 md:w-6 md:h-6 rounded-full ${isPlaying ? 'bg-white animate-ping' : 'bg-black border-2'}`
    }),
    React.createElement(
      "span",
      {
        className: `text-[10px] md:text-xl uppercase font-black tracking-widest md:tracking-[0.8em] ${chaosMode ? 'text-black' : overdrive ? 'text-black' : 'text-white'}`
      },
      isPlaying ? `PULSE_${structure.bpm}` : 'WAITING'
    )
  );
};

export default AudioEngine;