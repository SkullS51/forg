import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GenerationState } from '/src/types.ts';
import Sidebar from './components/Sidebar.jsx';
import Gallery from '/src/components/Gallery.jsx';
import AudioEngine from './components/AudioEngine.jsx';
import Visualizer from './components/Visualizer.jsx';
import CreationDropZone from '/src/components/CreationDropZone.tsx';
import ProtectionLayer from '/src/components/ProtectionLayer.tsx';

function getGeminiAiInstance(apiKey: string) {
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
  const [cooldown, setCooldown] = useState(0);
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [apiKey, setApiKey] = useState(''); // Local API Key state

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
        return {
          groqKey: defaultKey,
          useGroqForAudio: true,
          enableBloom: true,
          bloomIntensity: 50,
          enableChromaticAberration: true,
          chromaticAberrationIntensity: 50,
          enableScanlines: true,
          scanlineIntensity: 50,
          generationType: 'image',
          videoAspectRatio: '16:9',
          videoResolution: '720p',
        };
      }
    }
    return {
      groqKey: defaultKey,
      useGroqForAudio: true,
      enableBloom: true,
      bloomIntensity: 50,
      enableChromaticAberration: true,
      chromaticAberrationIntensity: 50,
      enableScanlines: true,
      scanlineIntensity: 50,
      generationType: 'image',
      videoAspectRatio: '16:9',
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

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

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

  const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, initialBackoff = 2500) => {
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
      } catch (e: any) {
        if (e instanceof Error && e.message === "RATE_LIMIT_EXCEEDED_FINAL_FETCH") throw e;
        if (i === retries - 1) throw e;
        await new Promise(r => setTimeout(r, backoff));
      }
    }
    throw new Error("NETWORK_FAILURE_MAX_RETRIES");
  };

  const callGeminiWithRetry = async (
    apiCall: () => Promise<any>,
    retries = 3,
    initialBackoff = 2500
  ) => {
    let backoff = initialBackoff;
    for (let i = 0; i < retries; i++) {
      try {
        return await apiCall();
      } catch (error: any) {
        const isRateLimitError = (error.status === 429) || (error.message && error.message.includes("429"));
        if (isRateLimitError) {
          if (i === retries - 1) throw new Error("RATE_LIMIT_EXCEEDED_FINAL_GEMINI");
          await new Promise(r => setTimeout(r, backoff));
          backoff *= 2;
          continue;
        }
        if (error instanceof Error && error.message.includes("Requested entity was not found.")) {
          throw new Error("VEO_API_KEY_ERROR: Requested entity was not found. Please select a valid paid API key.");
        }
        if (i === retries - 1) throw error;
        await new Promise(r => setTimeout(r, backoff));
      }
    }
    throw new Error("GEMINI_API_FAILURE_MAX_RETRIES");
  };

  const handleSelectApiKey = async (key?: string) => {
    if (key) {
      setApiKey(key);
      console.log('API Key set:', key);
      setError(null);
    } else {
      try {
        await window.aistudio.openSelectKey();
        setShowApiKeyPrompt(false);
        setError(null);
        // The `GoogleGenAI` instance will be re-created in `handleGenerate` with the new key.
      } catch (e: any) {
        setError("API_KEY_SELECTION_FAILED: " + e.message);
      }
    }
  };

  const handleGenerate = useCallback(async (generationTypeOverride = null, dragonPower = 50) => {
    if (!prompt.trim() || status === GenerationState.GENERATING || status === GenerationState.VIDEO_GENERATING || cooldown > 0) return;
    setError(null);
    setShowApiKeyPrompt(false);
    await resumeAudio();

    try {
      const currentApiKey = apiKey || process.env.GEMINI_API_KEY; // Use local state first, then env
      if (!currentApiKey) {
        setShowApiKeyPrompt(true);
        throw new Error("API_KEY_MISSING: Please provide an API key.");
      }
      const ai = getGeminiAiInstance(currentApiKey);
      let mediaUrl = null;
      let mediaType = generationTypeOverride || kernelConfig.generationType;
      let text = '';

      const adjustedPrompt = `[DRAGON_POWER:${dragonPower}] ${prompt}`;

      if (dragonPower < 10 || dragonPower > 90) {
        // setIsBanned(true);
        // throw new Error("DRAGON_POWER_VIOLATION: Dragon Power outside safe limits.");
      }

      if (adjustedPrompt.toLowerCase().includes("forbidden_word")) {
        // setIsBanned(true);
        // throw new Error("VOID_PROTOCOL_VIOLATION: Forbidden keyword detected.");
      }

      if (kernelConfig.generationType === 'image') {
        setStatus(GenerationState.GENERATING);
        setLoadingMessage("HARVESTING NEURAL FLUID (VISUALS)...");
        const imageApiCall = await fetchWithRetry(`${import.meta.env.VITE_API_BASE_URL}/api/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: adjustedPrompt, aspectRatio: "1:1" })
        });
        const imageData = await imageApiCall.json();
        if (!imageData.imageUrl) throw new Error("REDHAT_IMAGE_API_FAILURE");
        mediaUrl = imageData.imageUrl;

        const textApiCall = await fetchWithRetry(`${import.meta.env.VITE_API_BASE_URL}/api/generate-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: `Describe the following image: ${adjustedPrompt}` })
        });
        const textData = await textApiCall.json();
        if (!textData.text) throw new Error("REDHAT_TEXT_API_FAILURE");
        text = textData.text;

      } else { // 'text' generation
        setStatus(GenerationState.GENERATING);
        setLoadingMessage("IGNITING KERNEL (TEXT)...");
        const textApiCall = await fetchWithRetry(`${import.meta.env.VITE_API_BASE_URL}/api/generate-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: `[MAX_BRUTALITY] ${adjustedPrompt}. RED AND BLACK BRUTALIST ART.` })
        });
        const textData = await textApiCall.json();
        if (!textData.text) throw new Error("REDHAT_TEXT_API_FAILURE");
        text = textData.text;
      }

      setLoadingMessage("ROUTING HIGH-DENSITY PROTOCOL (AUDIO)....");
      let audioConfig;

      if (kernelConfig.useGroqForAudio && kernelConfig.groqKey) {
        const groqPayload = {
          model: "llama-3.1-405b-reasoning",
          messages: [
            {
              role: "system",
              content: "S-1792 KERNEL: You are a brutal metal compositor. Return ONLY raw JSON: { \"bpm\": number (200-999), \"pattern\": 16x8 matrix of intensities 0-255 }. Prompt defines the atmosphere."
            },
            { role: "user", content: `COMPOSITE PATTERN FOR: ${adjustedPrompt}` }
          ],
          temperature: 0.7,
          max_tokens: 1024,
          response_format: { type: "json_object" }
        };
        console.log("DEBUG: Groq Audio Request:", JSON.stringify(groqPayload, null, 2));
        const groqRes = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${kernelConfig.groqKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(groqPayload)
        });
        const data = await groqRes.json();
        if (!data.choices?.[0]?.message?.content) throw new Error("GROQ_EMPTY_STREAM");
        audioConfig = JSON.parse(data.choices[0].message.content);
      } else { // Use Red Hat API for audio generation
        const audioApiCall = await fetchWithRetry(`${import.meta.env.VITE_API_BASE_URL}/api/generate-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: `Generate brutal metal JSON for the prompt "${adjustedPrompt}".` })
        });
        const audioData = await audioApiCall.json();
        if (!audioData.audioConfig) throw new Error("REDHAT_AUDIO_API_FAILURE");
        audioConfig = audioData.audioConfig;
      }

      const resultData = {
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        content: text,
        trackStructure: {
          bpm: audioConfig.bpm || 666,
          pattern: audioConfig.pattern || Array(16).fill(0).map(() => Array(8).fill(0).map(() => Math.random() > 0.5 ? 255 : 0)),
          distorted: true,
          gain: volume,
          atmosphere: 'total_annihilation'
        },
        prompt
      };

      setCurrentResult(resultData);
      setHistory(prev => [{ id: Date.now().toString(), timestamp: Date.now(), data: resultData }, ...prev].slice(0, 50));
      setStatus(GenerationState.PLAYING);
    } catch (err: any) {
      setError(err.message);
      setStatus(GenerationState.ERROR);
    } finally {
      setLoadingMessage('');
    }
  }, [prompt, status, cooldown, kernelConfig, volume, overdrive, chaosMode, resumeAudio, apiKey]);


  return (
    <div className={`relative flex flex-col h-[100dvh] w-screen overflow-hidden select-none ${chaosMode ? 'invert saturate-200 contrast-125' : ''}`}>
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://picsum.photos/seed/dragon_background/1920/1080?blur=2" // Placeholder dragon background
          alt="Dragon Background"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        {/* Overlay for dark/fiery effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-70"></div>
      </div>

      {/* Main Content Layer */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full w-full">
      {/* API Key Input (placeholder if needed) */}
      {!apiKey && (
        <div className="fixed top-4 left-4 z-50 bg-gray-900/80 p-4 rounded-lg border border-red-800">
          <input
            type="text"
            placeholder="Enter API Key..."
            onChange={(e) => handleSelectApiKey(e.target.value)}
            className="bg-black border border-red-600 p-2 rounded text-red-400"
          />
        </div>
      )}
      <CreationDropZone
        handleGenerate={handleGenerate}
        setPrompt={setPrompt}
        prompt={prompt}
        setStatus={setStatus}
        setLoadingMessage={setLoadingMessage}
        setCooldown={setCooldown}
        cooldown={cooldown}
        status={status}
        loadingMessage={loadingMessage}
        error={error}
        showApiKeyPrompt={showApiKeyPrompt}
        handleSelectApiKey={handleSelectApiKey}
        kernelConfig={kernelConfig}
        setKernelConfig={setKernelConfig}
        chaosMode={chaosMode}
        setChaosMode={setChaosMode}
        overdrive={overdrive}
        setOverdrive={setOverdrive}
        volume={volume}
        setVolume={setVolume}
        currentResult={currentResult}
        history={history}
        setShowGallery={setShowGallery}
        showGallery={showGallery}
        resumeAudio={resumeAudio}
        audioContextRef={audioContextRef}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        setCurrentResult={setCurrentResult}
        setIsBanned={setIsBanned}
      />
      <ProtectionLayer trigger={isBanned} />
      </div>
    </div>
  );
}
