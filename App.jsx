import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GenerationState } from './types.js';
import Sidebar from './components/Sidebar.jsx';
import Gallery from '/src/components/Gallery.jsx';
import AudioEngine from './components/AudioEngine.jsx';
import Visualizer from './components/Visualizer.jsx';

function getGeminiAiInstance() {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING: API key is not configured.");
  }
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
        const parsed = JSON.parse(saved);
        return { 
          ...parsed, 
          groqKey: parsed.groqKey || defaultKey,
          enableBloom: parsed.enableBloom ?? true,
          bloomIntensity: parsed.bloomIntensity ?? 50,
          enableChromaticAberration: parsed.enableChromaticAberration ?? true,
          chromaticAberrationIntensity: parsed.chromaticAberrationIntensity ?? 50,
          enableScanlines: parsed.enableScanlines ?? true,
          scanlineIntensity: parsed.scanlineIntensity ?? 50,
          generationType: parsed.generationType ?? 'image',
          videoAspectRatio: parsed.videoAspectRatio ?? '16:9',
          videoResolution: parsed.videoResolution ?? '720p',
        };
      } catch (e) {
        return { groqKey: defaultKey, useGroqForAudio: true, generationType: 'image' };
      }
    }
    return { groqKey: defaultKey, useGroqForAudio: true, generationType: 'image' };
  });

  const audioContextRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('VOID_KERNEL_CONFIG', JSON.stringify(kernelConfig));
  }, [kernelConfig]);

  useEffect(() => {
    localStorage.setItem('VOID_CHAOS_MODE', chaosMode.toString());
  }, [chaosMode]);

  const resumeAudio = async () => {
    if (!audioContextRef.current) {
      const AudioContextClass = (window.AudioContext || window.webkitAudioContext);
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const fetchWithRetry = async (url, options, retries = 3, initialBackoff = 2500) => {
    let backoff = initialBackoff;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) {
                await new Promise(r => setTimeout(r, backoff));
                backoff *= 2;
                continue;
            }
            if (!response.ok) throw new Error(`API_ERROR_${response.status}`);
            return response;
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, backoff));
        }
    }
    throw new Error("NETWORK_FAILURE"); 
  };

  const callGeminiWithRetry = async (apiCall, retries = 3, initialBackoff = 2500) => {
      let backoff = initialBackoff;
      for (let i = 0; i < retries; i++) {
          try {
              return await apiCall();
          } catch (error) {
              const isRateLimit = (error.status === 429) || (error.message && error.message.includes("429"));
              if (isRateLimit && i < retries - 1) {
                  await new Promise(r => setTimeout(r, backoff));
                  backoff *= 2;
                  continue;
              }
              throw error;
          }
      }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || status === GenerationState.GENERATING || status === GenerationState.VIDEO_GENERATING) return;
    setError(null);
    setShowApiKeyPrompt(false);
    await resumeAudio();

    try {
      const ai = getGeminiAiInstance();
      let mediaUrl = null;
      let mediaType = kernelConfig.generationType;

      if (kernelConfig.generationType === 'video') {
        setStatus(GenerationState.VIDEO_GENERATING); 
        setLoadingMessage("PREPARING VIDEO SEQUENCE...");
        let operation = await callGeminiWithRetry(() => ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: `[MAX_BRUTALITY] ${prompt}. VISCERAL INDUSTRIAL DECAY, RED AND BLACK, BRUTALIST ART.`,
          config: { numberOfVideos: 1, resolution: kernelConfig.videoResolution, aspectRatio: kernelConfig.videoAspectRatio }
        }));
        setLoadingMessage("RENDERING VOID-SEQUENCE...");
        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          operation = await callGeminiWithRetry(() => ai.operations.getVideosOperation({operation: operation}));
        }
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) throw new Error("VIDEO_CORE_FAILURE");
        mediaUrl = `${downloadLink}&key=${process.env.API_KEY}`;
      } else { 
        setStatus(GenerationState.GENERATING); 
        setLoadingMessage("HARVESTING NEURAL FLUID...");
        const imageResponse = await callGeminiWithRetry(() => 
          ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: { parts: [{ text: `[MAX_BRUTALITY] ${prompt}. VISCERAL INDUSTRIAL DECAY, RED AND BLACK, BRUTALIST ART.` }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
          })
        );
        const imgPart = imageResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (!imgPart?.inlineData?.data) throw new Error("ART_CORE_FAILURE");
        mediaUrl = `data:image/png;base64,${imgPart.inlineData.data}`;
      }

      setLoadingMessage("ROUTING AUDIO PROTOCOL...");
      let audioConfig;
      if (kernelConfig.useGroqForAudio && kernelConfig.groqKey) {
        const groqRes = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${kernelConfig.groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.1-405b-reasoning",
            messages: [{ role: "system", content: "Return ONLY raw JSON: { \"bpm\": number, \"pattern\": 16x8 matrix }." }, { role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });
        const data = await groqRes.json();
        audioConfig = JSON.parse(data.choices[0].message.content);
      } else {
        const audioGeminiResponse = await callGeminiWithRetry(() => 
          ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: { parts: [{ text: `Generate brutal metal JSON for "${prompt}". { "bpm": 200-999, "pattern": 16x8 matrix }.` }] },
            config: { responseMimeType: "application/json" }
          })
        );
        audioConfig = JSON.parse(audioGeminiResponse.text || '{}');
      }

      const result = {
        mediaUrl, mediaType, trackStructure: {
          bpm: audioConfig.bpm || 666,
          pattern: audioConfig.pattern || Array(16).fill(0).map(() => Array(8).fill(0).map(() => Math.random() > 0.5 ? 255 : 0)),
          distorted: true, gain: volume, atmosphere: 'total_annihilation'
        }, prompt
      };
      setCurrentResult(result);
      setHistory(prev => [{ id: Date.now().toString(), timestamp: Date.now(), data: result }, ...prev].slice(0, 50));
      setStatus(GenerationState.PLAYING);
    } catch (err) {
      setError(err.message);
      setStatus(GenerationState.ERROR);
    } finally {
      setLoadingMessage(''); 
    }
  };

  return (
    <div className={`flex flex-col h-[100dvh] w-screen bg-black text-red-600 font-bold overflow-hidden select-none ${chaosMode ? 'invert saturate-200 contrast-125' : ''}`}>
      <header className="flex h-12 border-b-2 border-red-600 bg-black z-50">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="px-4 border-r-2 border-red-900 bg-[#100000] text-white italic text-xs uppercase hover:bg-red-600">Kernel_Config</button>
        <button onClick={() => setShowGallery(true)} className="px-4 border-r-2 border-red-900 bg-[#100000] text-white italic text-xs uppercase hover:bg-red-600">View_Gallery</button>
        <div className="flex flex-1 items-stretch">
          <button onClick={() => setOverdrive(!overdrive)} className={`flex-1 px-1 border-r-2 border-red-900 transition-all text-[10px] uppercase font-black ${overdrive ? 'bg-red-600 text-white' : 'bg-black text-red-900'}`}>Overdrive</button>
          <button onClick={() => setChaosMode(!chaosMode)} className={`flex-1 px-1 border-r-2 border-red-900 transition-all text-[10px] uppercase font-black ${chaosMode ? 'bg-yellow-500 text-black' : 'bg-black text-red-900'}`}>Chaos</button>
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden relative">
        <div className={`${sidebarOpen ? 'w-full md:w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-[#050000] z-40 h-full absolute md:relative border-r-2 border-red-900`}>
          <Sidebar history={history} onSelect={i => { resumeAudio(); setCurrentResult(i.data); setPrompt(i.data.prompt); setStatus(GenerationState.PLAYING); setSidebarOpen(false); }} currentId={currentResult?.prompt} kernelConfig={kernelConfig} setKernelConfig={setKernelConfig} />
        </div>
        <div className="flex-1 flex flex-col min-w-0 bg-[#020202] relative">
          <div className="flex-1 relative flex items-center justify-center p-2 md:p-8 overflow-hidden">
            {(status === GenerationState.GENERATING || status === GenerationState.VIDEO_GENERATING || error) && (
              <div className="absolute inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center text-center p-4">
                {error ? (
                  <div className="text-2xl md:text-5xl text-white bg-red-800 p-4 border-2 border-white uppercase font-black">{`ERROR: ${error}`}</div>
                ) : (
                  <>
                    <div className="text-5xl md:text-8xl font-black italic text-white animate-pulse">WEAPONIZING...</div>
                    <div className="text-red-600 text-[10px] mt-4 uppercase">{loadingMessage}</div>
                  </>
                )}
              </div>
            )}
            {currentResult && (
              <div className="relative w-full h-full max-w-full max-h-full aspect-square border-2 border-red-600 bg-black">
                <Visualizer 
                  mediaUrl={currentResult.mediaUrl} 
                  mediaType={currentResult.mediaType} 
                  isActive={status === GenerationState.PLAYING} 
                  bpm={currentResult.trackStructure.bpm} 
                  currentPrompt={prompt} 
                  overdrive={overdrive} 
                  chaosMode={chaosMode} 
                  enableBloom={kernelConfig.enableBloom} 
                  bloomIntensity={kernelConfig.bloomIntensity} 
                />
              </div>
            )}
          </div>
          <footer className="p-4 md:p-6 border-t-2 border-red-600 bg-black space-y-4">
            <div className="flex gap-2 items-stretch h-14 md:h-20">
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="INJECT SEED..." className="flex-1 bg-[#0a0000] border-2 border-red-900 p-3 text-red-500 focus:outline-none focus:border-white resize-none uppercase font-black" onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleGenerate())}></textarea>
              <button onClick={handleGenerate} disabled={status === GenerationState.GENERATING || status === GenerationState.VIDEO_GENERATING} className="bg-red-600 text-black px-6 md:px-12 text-xl md:text-4xl hover:bg-white transition-all font-black italic">IGNITE</button>
            </div>
            {currentResult && (
              <div className="flex-1 min-w-[140px]">
                <AudioEngine structure={currentResult.trackStructure} volume={volume} isPlaying={status === GenerationState.PLAYING} currentPrompt={prompt} audioContext={audioContextRef.current} overdrive={overdrive} chaosMode={chaosMode} />
              </div>
            )}
          </footer>
        </div>
      </div>
      {showGallery && <Gallery history={history} onClose={() => setShowGallery(false)} />}
    </div>
  );
}
      videoResolution: '720p',
    };
  });

  const audioContextRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('VOID_KERNEL_CONFIG', JSON.stringify(kernelConfig));
  }, [kernelConfig]);

  useEffect(() => {
    localStorage.setItem('VOID_CHAOS_MODE', chaosMode.toString());
  }, [chaosMode]);



 const resumeAudio = async () => {
    if (!audioContextRef.current) {
      const AudioContextClass = (window.AudioContext || window.webkitAudioContext);
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const fetchWithRetry = async (url, options, retries = 3, initialBackoff = 2500) => {
    let backoff = initialBackoff;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) {
                if (i === retries - 1) throw new Error("RATE_LIMIT_EXCEEDED_FINAL_FETCH");
                await new Promise(r => setTimeout(r, backoff));
                backoff *= 2;
                continue;
            }
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API_ERROR_${response.status}: ${errorBody}`);
            }
            return response;
        } catch (e) {
            if (e instanceof Error && e.message === "RATE_LIMIT_EXCEEDED_FINAL_FETCH") throw e;
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, backoff));
        }
    }
    throw new Error("NETWORK_FAILURE_MAX_RETRIES"); 
  };

  const callGeminiWithRetry = async (
    apiCall,
    retries = 3,
    initialBackoff = 2500
  ) => {
      let backoff = initialBackoff;
      for (let i = 0; i < retries; i++) {
          try {
              return await apiCall();
          } catch (error) {
              const isRateLimitError = (error.status === 429) || (error.message && error.message.includes("429"));
              if (isRateLimitError) {
                  if (i === retries - 1) throw new Error("RATE_LIMIT_EXCEEDED_FINAL_GEMINI");
                  await new Promise(r => setTimeout(r, backoff));
                  backoff *= 2;
                  continue;
              }
              if (i instanceof Error && error.message.includes("Requested entity was not found.")) {
                // Specific error for Veo API key issues
                throw new Error("VEO_API_KEY_ERROR: Requested entity was not found. Please select a valid paid API key.");
              }
              if (i === retries - 1) throw error;
              await new Promise(r => setTimeout(r, backoff));
          }
      }
      throw new Error("GEMINI_API_FAILURE_MAX_RETRIES");
  };

    const handleGenerate = async () => {
    if (!prompt.trim() || status === GenerationState.GENERATING || status === GenerationState.VIDEO_GENERATING) return;
    
    setError(null);
    setShowApiKeyPrompt(false);
    await resumeAudio();

    try {
      const ai = getGeminiAiInstance();
      let mediaUrl = null;
      let mediaType = kernelConfig.generationType;

      if (kernelConfig.generationType === 'video') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setShowApiKeyPrompt(true);
          return;
        }
        
        setStatus(GenerationState.VIDEO_GENERATING); 
        setLoadingMessage("PREPARING VIDEO SEQUENCE...");
        
        let operation = await callGeminiWithRetry(() => ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: `[MAX_BRUTALITY] ${prompt}. VISCERAL INDUSTRIAL DECAY, SERRATED OBSIDIAN STRUCTURES, DARKNESS, RED AND BLACK, HIGH CONTRAST BRUTALIST ART.`,
          config: {
            numberOfVideos: 1,
            resolution: kernelConfig.videoResolution,
            aspectRatio: kernelConfig.videoAspectRatio
          }
        }));

        setLoadingMessage("RENDERING VOID-SEQUENCE...");
        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          operation = await callGeminiWithRetry(() => ai.operations.getVideosOperation({operation: operation}));
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) throw new Error("VIDEO_CORE_FAILURE");
        mediaUrl = `${downloadLink}&key=${process.env.API_KEY}`;

      } else { 
        setStatus(GenerationState.GENERATING); 
        setLoadingMessage("HARVESTING NEURAL FLUID (VISUALS)...");
        const imageResponse = await callGeminiWithRetry(() => 
          ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: { 
              parts: [{ text: `[MAX_BRUTALITY] ${prompt}. VISCERAL INDUSTRIAL DECAY, SERRATED OBSIDIAN STRUCTURES, DARKNESS, RED AND BLACK, HIGH CONTRAST BRUTALIST ART.` }] 
            },
            config: { imageConfig: { aspectRatio: "1:1" } }
          })
        );

        const imgPart = imageResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (!imgPart?.inlineData?.data) throw new Error("ART_CORE_FAILURE");
        mediaUrl = `data:image/png;base64,${imgPart.inlineData.data}`;
      }

      setLoadingMessage("ROUTING HIGH-DENSITY PROTOCOL (AUDIO)...");
      let audioConfig;

      

      let audioConfig;

      if (kernelConfig.useGroqForAudio && kernelConfig.groqKey) {
        const groqRes = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${kernelConfig.groqKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.1-405b-reasoning",
            messages: [
              { 
                role: "system", 
                content: "S-1792 KERNEL: You are a brutal metal compositor. Return ONLY raw JSON: { \"bpm\": number (200-999), \"pattern\": 16x8 matrix of intensities 0-255 }. Prompt defines the atmosphere." 
              },
              { role: "user", content: `COMPOSITE PATTERN FOR: ${prompt}` }
            ],
            temperature: 0.7,
            max_tokens: 1024,
            response_format: { type: "json_object" }
          })
        });
        const data = await groqRes.json();
        if (!data.choices?.[0]?.message?.content) throw new Error("GROQ_EMPTY_STREAM");
        audioConfig = JSON.parse(data.choices[0].message.content);
      } else {
        const audioGeminiResponse = await callGeminiWithRetry(() => 
          ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { 
              parts: [{ text: `Generate brutal metal JSON for the prompt "${prompt}". Format: { "bpm": number (200-999), "pattern": 16x8 matrix where values are 0-255 }. Output raw JSON only.` }] 
            },
            config: { responseMimeType: "application/json" }
          })
        );
        audioConfig = JSON.parse(audioGeminiResponse.text || '{}');
      }

      const result = {
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        trackStructure: {
          bpm: audioConfig.bpm || 666,
          pattern: audioConfig.pattern || Array(16).fill(0).map(() => Array(8).fill(0).map(() => Math.random() > 0.5 ? 255 : 0)),
          distorted: true,
          gain: volume,
          atmosphere: 'total_annihilation'
        },
        prompt: prompt
      };

      setCurrentResult(result);
      setHistory(prev => [{ id: Date.now().toString(), timestamp: Date.now(), data: result }, ...prev].slice(0, 50));
      setStatus(GenerationState.PLAYING);
    } catch (error) {
      if (error instanceof Error) {
          if (error.message.includes("RATE_LIMIT_EXCEEDED_FINAL")) {
              setError("SENTRY_RATE_LIMIT (429) - SYSTEM COOLDOWN");
          } else if (error.message.includes("VEO_API_KEY_ERROR")) {
              setError(error.message);
              setShowApiKeyPrompt(true);
          }
          else {
              setError(error.message);
          }
      } else {
          setError("SYNTHESIS_ERROR");
      }
      setStatus(GenerationState.ERROR);
    } finally {
      setLoadingMessage(''); 
    }
  };

  const handleSelectApiKey = async () => {
    try {
      await window.aistudio.openSelectKey();
      setShowApiKeyPrompt(false); // Assume successful selection and hide the prompt
      setError(null); // Clear any previous API key errors
      // The `GoogleGenAI` instance will be re-created in `handleGenerate` with the new key.
    } catch (e) {
      setError("API_KEY_SELECTION_FAILED: " + e.message);
    }
  };


  return (
    <div className={`flex flex-col h-[100dvh] w-screen bg-black text-red-600 font-bold overflow-hidden select-none ${chaosMode ? 'invert saturate-200 contrast-125' : ''}`}>
    <header className="flex h-12 border-b-2 border-red-600 bg-black z-50 flex-shrink-0">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="px-4 border-r-2 border-red-900 bg-[#100000] text-white italic text-xs uppercase hover:bg-red-600 transition-colors"
      >
        Kernel_Config
      </button>
      <button
        onClick={() => setShowGallery(true)}
        className="px-4 border-r-2 border-red-900 bg-[#100000] text-white italic text-xs uppercase hover:bg-red-600 transition-colors"
      >
        View_Gallery
      </button>
      <div className="flex flex-1 items-stretch">
        <button
          onClick={() => setOverdrive(!overdrive)}
          className={`flex-1 px-1 border-r-2 border-red-900 transition-all text-[10px] uppercase font-black ${overdrive ? 'bg-red-600 text-white' : 'bg-black text-red-900'}`}
        >
          Overdrive
        </button>
        <button
          onClick={() => setChaosMode(!chaosMode)}
          className={`flex-1 px-1 border-r-2 border-red-900 transition-all text-[10px] uppercase font-black ${chaosMode ? 'bg-yellow-500 text-black' : 'bg-black text-red-900'}`}
        >
          Chaos
        </button>
        <div className="hidden sm:flex items-center px-4 bg-[#050000] border-r-2 border-red-900 gap-2">
          <span className="text-[7px] text-red-900 uppercase">Reasoning_Bypass:</span>
          <div
            className={`w-2 h-2 rounded-full ${kernelConfig.useGroqForAudio ? 'bg-green-500' : 'bg-red-900'}`}
          ></div>
        </div>
      </div>
    </header>
    <div className="flex-1 flex overflow-hidden relative">
      <div
        className={`${sidebarOpen ? 'w-full md:w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-[#050000] z-40 h-full absolute md:relative border-r-2 border-red-900 shadow-2xl`}
      >
        <Sidebar
          history={history}
          onSelect={i => {
            resumeAudio();
            setCurrentResult(i.data);
            setPrompt(i.data.prompt);
            setStatus(GenerationState.PLAYING);
            setSidebarOpen(false);
          }}
          currentId={currentResult?.prompt}
          kernelConfig={kernelConfig}
          setKernelConfig={setKernelConfig}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-[#020202] relative">
        <div className="flex-1 relative flex items-center justify-center p-2 md:p-8 overflow-hidden">
          {(status === GenerationState.GENERATING || status === GenerationState.VIDEO_GENERATING || cooldown > 0 || error || showApiKeyPrompt) && (
            <div className="absolute inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center text-center p-4">
              {cooldown > 0 ? (
                <>
                  <div className="text-4xl md:text-8xl text-red-600 font-black italic">COOLDOWN</div>
                  <div className="text-white text-4xl md:text-7xl mt-4 font-mono">{`${cooldown}S`}</div>
                  <div className="text-red-900 text-[10px] mt-6 tracking-widest uppercase">Kernel Safety Lock Engaged</div>
                </>
              ) : showApiKeyPrompt ? (
                <>
                  <div className="text-xl md:text-4xl text-white bg-red-800 p-4 border-2 border-white animate-pulse uppercase font-black tracking-wide">
                    {`ERROR: ${error || "VEO_API_KEY_REQUIRED"}`}
                  </div>
                  <div className="text-red-600 text-[10px] md:text-sm font-black tracking-[0.5em] mt-6 uppercase">
                    VEO models require a paid API key. Select or configure one to proceed.
                  </div>
                  <button


  );
};

