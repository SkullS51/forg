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
  const [chaosMode, setChaosMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const audioContextRef = useRef(null);

  const resumeAudio = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
    return audioContextRef.current;
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || status === GenerationState.GENERATING) return;
    setError(null);
    await resumeAudio();
    setStatus(GenerationState.GENERATING);
    setLoadingMessage("IGNITING KERNEL...");

    try {
      const ai = getGeminiAiInstance();
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: { parts: [{ text: `[MAX_BRUTALITY] ${prompt}. RED AND BLACK BRUTALIST ART.` }] }
      });
      
      const mediaUrl = `data:image/png;base64,${imageResponse.candidates[0].content.parts.find(p => p.inlineData).inlineData.data}`;
      
      const result = {
        mediaUrl,
        mediaType: 'image',
        trackStructure: {
          bpm: 666,
          pattern: Array(16).fill(0).map(() => Array(8).fill(0).map(() => Math.random() > 0.5 ? 255 : 0)),
        },
        prompt
      };

      setCurrentResult(result);
      setHistory(prev => [result, ...prev]);
      setStatus(GenerationState.PLAYING);
    } catch (err) {
      setError(err.message);
      setStatus(GenerationState.ERROR);
    } finally {
      setLoadingMessage('');
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-black text-red-600 font-bold overflow-hidden">
      <header className="flex h-12 border-b-2 border-red-600 bg-black z-50">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="px-4 border-r-2 border-red-900 text-xs uppercase">Config</button>
        <div className="flex-1 flex items-center justify-center text-[10px] tracking-[0.3em]">VOID-METAL: S-1792 KERNEL</div>
      </header>
      
      <div className="flex-1 flex relative overflow-hidden">
        {sidebarOpen && (
          <div className="absolute inset-y-0 left-0 w-64 bg-[#050000] border-r-2 border-red-900 z-40">
            <Sidebar history={history} onSelect={(item) => { setCurrentResult(item); setSidebarOpen(false); }} />
          </div>
        )}
        
        <div className="flex-1 flex flex-col bg-[#020202]">
          <div className="flex-1 relative flex items-center justify-center p-4">
            {error && <div className="text-white bg-red-900 p-4 border-2 border-red-600 z-50">{error}</div>}
            {status === GenerationState.GENERATING && <div className="text-4xl animate-pulse italic text-white">WEAPONIZING...</div>}
            {currentResult && !error && (
              <Visualizer 
                mediaUrl={currentResult.mediaUrl} 
                isActive={status === GenerationState.PLAYING} 
                overdrive={overdrive} 
              />
            )}
          </div>
          
          <footer className="p-4 border-t-2 border-red-600 bg-black">
            <div className="flex gap-2">
              <input 
                value={prompt} 
                onChange={e => setPrompt(e.target.value)}
                placeholder="INJECT SEED..." 
                className="flex-1 bg-[#0a0000] border-2 border-red-900 p-3 text-red-500 uppercase"
              />
              <button onClick={handleGenerate} className="bg-red-600 text-black px-6 font-black italic">IGNITE</button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

