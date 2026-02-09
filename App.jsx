
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GenerationState } from './types.js'; // Updated import
import Sidebar from './components/Sidebar.jsx';
import AudioEngine from './components/AudioEngine.jsx';
import Visualizer from './components/Visualizer.jsx';

// AudioTrackConfig interface removed as part of TS stripping for direct browser execution.
// It can remain in types.ts for reference if desired.

const App = () => {
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
  
  const [kernelConfig, setKernelConfig] = useState(() => {
    const saved = localStorage.getItem('VOID_KERNEL_CONFIG');
    const defaultKey = "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"; // Updated default Groq API key
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...parsed, groqKey: parsed.groqKey || defaultKey };
      } catch (e) {
        return { groqKey: defaultKey, useGroqForAudio: true };
      }
    }
    return { groqKey: defaultKey, useGroqForAudio: true };
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
              if (i === retries - 1) throw error;
              await new Promise(r => setTimeout(r, backoff));
          }
      }
      throw new Error("GEMINI_API_FAILURE_MAX_RETRIES");
  };


  const handleGenerate = async () => {
    if (!prompt.trim() || status === GenerationState.GENERATING || cooldown > 0) return;
    setError(null);
    await resumeAudio();

    try {
      // CRITICAL: Ensure process.env.API_KEY is available for Gemini
      if (!process.env.API_KEY || process.env.API_KEY === "") {
        throw new Error("GEMINI_API_KEY_UNDEFINED: Ensure process.env.API_KEY is configured in your environment.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      setStatus(GenerationState.GENERATING); 
      setLoadingMessage("HARVESTING NEURAL FLUID (VISUALS)...");
      const imageResponse = await callGeminiWithRetry(() => 
        ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { 
            parts: [{ text: `[MAX_BRUTALITY] ${prompt}. VISCERAL INDUSTRIAL DECAY, SERRATED OBSIDIAN STRUCTURES, DARKNESS, RED AND BLACK, HIGH CONTRAST BRUTALIST ART.` }] 
          },
          config: { imageConfig: { aspectRatio: "1:1" } }
        })
      );

      const imgPart = imageResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (!imgPart?.inlineData?.data) throw new Error("ART_CORE_FAILURE");
      const imageUrl = `data:image/png;base64,${imgPart.inlineData.data}`;

      setLoadingMessage("ROUTING HIGH-DENSITY PROTOCOL (AUDIO)...");
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
        imageUrl: imageUrl,
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
              setCooldown(45); 
          } else {
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

  return React.createElement(
    "div",
    {
      className: `flex flex-col h-[100dvh] w-screen bg-black text-red-600 font-bold overflow-hidden select-none ${chaosMode ? 'invert saturate-200 contrast-125' : ''}`
    },
    React.createElement(
      "header",
      { className: "flex h-12 border-b-2 border-red-600 bg-black z-50 flex-shrink-0" },
      React.createElement(
        "button",
        {
          onClick: () => setSidebarOpen(!sidebarOpen),
          className: "px-4 border-r-2 border-red-900 bg-[#100000] text-white italic text-xs uppercase hover:bg-red-600 transition-colors"
        },
        "Kernel_Config"
      ),
      React.createElement(
        "div",
        { className: "flex flex-1 items-stretch" },
        React.createElement(
          "button",
          {
            onClick: () => setOverdrive(!overdrive),
            className: `flex-1 px-1 border-r-2 border-red-900 transition-all text-[10px] uppercase font-black ${overdrive ? 'bg-red-600 text-white' : 'bg-black text-red-900'}`
          },
          "Overdrive"
        ),
        React.createElement(
          "button",
          {
            onClick: () => setChaosMode(!chaosMode),
            className: `flex-1 px-1 border-r-2 border-red-900 transition-all text-[10px] uppercase font-black ${chaosMode ? 'bg-yellow-500 text-black' : 'bg-black text-red-900'}`
          },
          "Chaos"
        ),
        React.createElement(
          "div",
          { className: "hidden sm:flex items-center px-4 bg-[#050000] border-r-2 border-red-900 gap-2" },
          React.createElement(
            "span",
            { className: "text-[7px] text-red-900 uppercase" },
            "Reasoning_Bypass:"
          ),
          React.createElement("div", {
            className: `w-2 h-2 rounded-full ${kernelConfig.useGroqForAudio ? 'bg-green-500' : 'bg-red-900'}`
          })
        )
      )
    ),
    React.createElement(
      "div",
      { className: "flex-1 flex overflow-hidden relative" },
      React.createElement(
        "div",
        {
          className: `${sidebarOpen ? 'w-full md:w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-[#050000] z-40 h-full absolute md:relative border-r-2 border-red-900 shadow-2xl`
        },
        React.createElement(Sidebar, {
          history: history,
          onSelect: i => {
            resumeAudio();
            setCurrentResult(i.data);
            setPrompt(i.data.prompt);
            setStatus(GenerationState.PLAYING);
            setSidebarOpen(false);
          },
          currentId: currentResult?.prompt,
          kernelConfig: kernelConfig,
          setKernelConfig: setKernelConfig
        })
      ),
      React.createElement(
        "div",
        { className: "flex-1 flex flex-col min-w-0 bg-[#020202] relative" },
        React.createElement(
          "div",
          { className: "flex-1 relative flex items-center justify-center p-2 md:p-8 overflow-hidden" },
          (status === GenerationState.GENERATING || cooldown > 0 || error) && // Added error to conditional display
            React.createElement(
              "div",
              { className: "absolute inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center text-center p-4" },
              cooldown > 0
                ? React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                      "div",
                      { className: "text-4xl md:text-8xl text-red-600 font-black italic" },
                      "COOLDOWN"
                    ),
                    React.createElement(
                      "div",
                      { className: "text-white text-4xl md:text-7xl mt-4 font-mono" },
                      `${cooldown}S`
                    ),
                    React.createElement(
                      "div",
                      { className: "text-red-900 text-[10px] mt-6 tracking-widest uppercase" },
                      "Kernel Safety Lock Engaged"
                    )
                  )
                : error
                    ? React.createElement(
                        "div",
                        { className: "text-2xl md:text-5xl text-white bg-red-800 p-4 border-2 border-white animate-pulse uppercase font-black tracking-wide" },
                        `ERROR: ${error}`
                      )
                    : React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(
                          "div",
                          { className: "text-5xl md:text-8xl font-black italic text-white animate-pulse" },
                          "WEAPONIZING..."
                        ),
                        React.createElement(
                          "div",
                          { className: "text-red-600 text-[10px] md:text-sm font-black tracking-[1.5em] mt-4 uppercase" },
                          loadingMessage || 'Initializing Protocol'
                        )
                      )
            ),
          currentResult
            ? React.createElement(
                "div",
                { className: "relative w-full h-full max-w-full max-h-full aspect-square border-2 border-red-600 bg-black shadow-[0_0_50px_rgba(255,0,0,0.1)]" },
                React.createElement(Visualizer, {
                  imageUrl: currentResult.imageUrl,
                  isActive: status === GenerationState.PLAYING,
                  bpm: currentResult.trackStructure.bpm,
                  currentPrompt: prompt,
                  overdrive: overdrive,
                  chaosMode: chaosMode
                })
              )
            : !loadingMessage && !cooldown && !error && // Only show idle title if no loading, cooldown, or error
              React.createElement(
                "div",
                { className: "opacity-10 text-3xl md:text-7xl tracking-tighter text-red-900 text-center uppercase" },
                React.createElement("h1", { className: "text-5xl md:text-9xl font-black italic glitch-text void-metal-title" }, "VOID-METAL"),
                React.createElement("div", { className: "text-md md:text-xl font-black italic glitch-text mt-4" }, "S-1792 KERNEL"),
                React.createElement("div", { className: "text-[10px] md:text-sm mt-8 uppercase font-bold tracking-[0.5em] text-red-900" }, "Feed the Sentry")
              )
        ),
        React.createElement(
          "footer",
          { className: "p-4 md:p-6 border-t-2 border-red-600 bg-black flex-shrink-0 space-y-4" },
          React.createElement(
            "div",
            { className: "flex gap-2 items-stretch h-14 md:h-20" },
            React.createElement("textarea", {
              value: prompt,
              onChange: e => setPrompt(e.target.value),
              placeholder: "INJECT SEED...",
              className: "flex-1 bg-[#0a0000] border-2 border-red-900 p-3 text-sm md:text-xl text-red-500 focus:outline-none focus:border-white resize-none uppercase font-black",
              onKeyDown: e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleGenerate())
            }),
            React.createElement(
              "button",
              {
                onClick: handleGenerate,
                disabled: status === GenerationState.GENERATING || cooldown > 0,
                className: "bg-red-600 text-black px-6 md:px-12 text-xl md:text-4xl hover:bg-white transition-all font-black italic disabled:opacity-30"
              },
              status === GenerationState.GENERATING ? 'BUSY' : 'IGNITE'
            )
          ),
          React.createElement(
            "div",
            { className: "flex flex-wrap items-center gap-4" },
            React.createElement(
              "div",
              { className: "flex-1 min-w-[140px]" },
              currentResult &&
                React.createElement(AudioEngine, {
                  structure: currentResult.trackStructure,
                  volume: volume,
                  isPlaying: status === GenerationState.PLAYING,
                  currentPrompt: prompt,
                  audioContext: audioContextRef.current,
                  overdrive: overdrive,
                  chaosMode: chaosMode
                })
            ),
            React.createElement(
              "div",
              { className: "w-full md:w-64 space-y-1" },
              React.createElement(
                "div",
                { className: "flex justify-between text-[8px] md:text-[10px] text-red-600 uppercase font-black" },
                React.createElement("span", null, "GAIN"),
                React.createElement("span", { className: "text-white" }, (volume * 10).toFixed(0))
              ),
              React.createElement("input", {
                type: "range",
                min: "0",
                max: "100",
                step: "1",
                value: volume,
                onChange: e => setVolume(parseFloat(e.target.value)),
                className: "w-full accent-red-600 h-1 bg-red-950 appearance-none border border-red-900 cursor-pointer"
              })
            ),
            React.createElement(
              "button",
              {
                onClick: () =>
                  currentResult &&
                  Object.assign(document.createElement('a'), {
                    download: `VOID_${Date.now()}.png`,
                    href: currentResult.imageUrl
                  }).click(),
                className: "border border-red-900 text-[10px] p-2 hover:bg-red-900 hover:text-white uppercase transition-all font-black"
              },
              "Extract"
            )
          )
          // Removed the old error display from here, as it's now handled centrally in the main content area
        )
      )
    )
  );
};

export default App;