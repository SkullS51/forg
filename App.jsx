import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GenerationState } from './types.js';
import Sidebar from './components/Sidebar.jsx';
import Gallery from '/src/components/Gallery.jsx';
import AudioEngine from './components/AudioEngine.jsx';
import Visualizer from './components/Visualizer.jsx';

function getGeminiAiInstance() {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY_MISSING");
  return new GoogleGenAI({ apiKey });
}

export default function App() {
  const [status, setStatus] = useState(GenerationState.IDLE);
  const [prompt, setPrompt] = useState('');
  const [currentResult, setCurrentResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [volume, setVolume] = useState(6.0);
  const [overdrive, setOverdrive] = useState(true);
  const [chaosMode, setChaosMode] = useState(() => localStorage.getItem('VOID_CHAOS_MODE') === 'true');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  
  const [kernelConfig, setKernelConfig] = useState(() => {
    const saved = localStorage.getItem('VOID_KERNEL_CONFIG');
    const defaultKey = "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";
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { groqKey: defaultKey, useGroqForAudio: true, generationType: 'image' };
      }
    }
    return { groqKey: defaultKey, useGroqForAudio: true, generationType: 'image' };
  });

  const audioContextRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('VOID_KERNEL_CONFIG', JSON.stringify(kernelConfig));
    localStorage.setItem('VOID_CHAOS_MODE', chaosMode.toString());
  }, [kernelConfig, chaosMode]);

  const resumeAudio = async () => {
    if (!audioContextRef.current) {
      const AudioContextClass = (window.AudioContext || window.webkitAudioContext);
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
    return audioContextRef.current;
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || status === GenerationState.GENERATING || status === GenerationState.VIDEO_GENERATING) return;
    setError(null);
    setShowApiKeyPrompt(false);
    await resumeAudio();

    try {
      const ai = getGeminiAiInstance();
      let mediaUrl = null;

      if (kernelConfig.generationType === 'video') {
        setStatus(GenerationState.VIDEO_GENERATING);
        setLoadingMessage("PREPARING VIDEO SEQUENCE...");
        let operation = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: `[MAX_BRUTALITY] ${prompt}. VISCERAL INDUSTRIAL DECAY.`,
          config: { numberOfVideos: 1 }
        });
        while (!operation.done) {
          await new Promise(r => setTimeout(r, 5000));
          operation = await ai.operations.getVideosOperation({operation});
        }
        mediaUrl = `${operation.response.generatedVideos[0].video.uri}&key=${process.env.API_KEY}`;
      } else {
        setStatus(GenerationState.GENERATING);
        setLoadingMessage("HARVESTING VISUALS...");
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: { parts: [{ text: `[MAX_BRUTALITY] ${prompt}. RED AND BLACK BRUTALIST ART.` }] }
        });
        mediaUrl = `data:image/png;base64,${imageResponse.candidates[0].content.parts.find(p => p.inlineData).inlineData.data}`;
      }

      setLoadingMessage("ROUTING AUDIO...");
      const audioGeminiResponse = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: { parts: [{ text: `Generate brutal metal JSON: { "bpm": 200, "pattern": 16x8 matrix }. Prompt: ${prompt}` }] },
        config: { responseMimeType: "application/json" }
      });
      const audioConfig = JSON.parse(audioGeminiResponse.text || '{}');

      const result = {
        mediaUrl, mediaType: kernelConfig.generationType,
        trackStructure: {
          bpm: audioConfig.bpm || 666,
          pattern: audioConfig.pattern || Array(16).fill(0).map(() => Array(8).fill(0).map(() => Math.random() > 0.5 ? 255 : 0)),
        }, prompt
      };
      setCurrentResult(result);
      setHistory(prev => [{ id: Date.now().toString(), data: result }, ...prev]);
      setStatus(GenerationState.PLAYING);
    } catch (err) {
      setError(err.message);
      setStatus(GenerationState.ERROR);
    } finally {
      setLoadingMessage('');
    }
  };

  return (
    <div className={`flex flex-col h-[100dvh] w-screen bg-black text-red-600 font-bold overflow-hidden ${chaosMode ? 'invert saturate-200' : ''}`}>
      <header className="flex h-12 border-b-2 border-red-600 bg-black z-50">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="px-4 border-r-2 border-red-900 bg-[#100000] text-white italic text-xs uppercase hover:bg-red-600">Kernel_Config</button>
        <button onClick={() => setShowGallery(true)} className="px-4 border-r-2 border-red-900 bg-[#100000] text-white italic text-xs uppercase hover:bg-red-600">View_Gallery</button>
        <div className="flex flex-1 items-stretch">
          <button onClick={() => setOverdrive(!overdrive)} className={`flex-1 px-1 border-r-2 border-red-900 text-[10px] uppercase ${overdrive ? 'bg-red-600 text-white' : 'bg-black'}`}>Overdrive</button>
          <button onClick={() => setChaosMode(!chaosMode)} className={`flex-1 px-1 border-r-2 border-red-900 text-[10px] uppercase ${chaosMode ? 'bg-yellow-500 text-black' : 'bg-black'}`}>Chaos</button>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden relative">
        <div className={`${sidebarOpen ? 'w-full md:w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-[#050000] z-40 h-full absolute md:relative border-r-2 border-red-900`}>
          <Sidebar history={history} onSelect={i => { setCurrentResult(i.data); setPrompt(i.data.prompt); setStatus(GenerationState.PLAYING); setSidebarOpen(false); }} kernelConfig={kernelConfig} setKernelConfig={setKernelConfig} />
        </div>
        
        <div className="flex-1 flex flex-col min-w-0 bg-[#020202] relative">
          <div className="flex-1 relative flex items-center justify-center p-4">
            {(status === GenerationState.GENERATING || status === GenerationState.VIDEO_GENERATING || error) && (
              <div className="absolute inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center">
                {error ? <div className="text-white bg-red-800 p-4 border-2 border-white uppercase font-black">{`ERROR: ${error}`}</div> : <div className="text-5xl font-black italic text-white animate-pulse">WEAPONIZING...</div>}
              </div>
            )}
            {currentResult && (
              <Visualizer mediaUrl={currentResult.mediaUrl} mediaType={currentResult.mediaType} isActive={status === GenerationState.PLAYING} bpm={currentResult.trackStructure.bpm} overdrive={overdrive} chaosMode={chaosMode} />
            )}
          </div>
          
          <footer className="p-4 border-t-2 border-red-600 bg-black space-y-4">
            <div className="flex gap-2 h-14">
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="INJECT SEED..." className="flex-1 bg-[#0a0000] border-2 border-red-900 p-3 text-red-500 focus:outline-none uppercase font-black" onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleGenerate())}></textarea>
              <button onClick={handleGenerate} className="bg-red-600 text-black px-6 text-xl hover:bg-white transition-all font-black italic">IGNITE</button>
            </div>
            {currentResult && <AudioEngine structure={currentResult.trackStructure} volume={volume} isPlaying={status === GenerationState.PLAYING} audioContext={audioContextRef.current} overdrive={overdrive} />}
          </footer>
        </div>
      </div>
      {showGallery && <Gallery history={history} onClose={() => setShowGallery(false)} />}
    </div>
  );
}
