import React, { useState, useRef, useEffect } from 'react';
import { GenerationState } from '/src/types.ts';

interface CreationDropZoneProps {
  handleGenerate: (generationTypeOverride?: string | null, dragonPower?: number) => Promise<void>;
  setPrompt: (prompt: string) => void;
  prompt: string;
  setStatus: (status: GenerationState) => void;
  
  setLoadingMessage: (message: string) => void;
  setCooldown: (cooldown: number) => void;
  cooldown: number;
  status: GenerationState;
  loadingMessage: string;
  error: string | null;
  showApiKeyPrompt: boolean;
  handleSelectApiKey: (key?: string) => Promise<void>;
  kernelConfig: any;
  setKernelConfig: (config: any) => void;
  chaosMode: boolean;
  setChaosMode: (mode: boolean) => void;
  overdrive: boolean;
  setOverdrive: (overdrive: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;
  currentResult: any;
  history: any[];
  setShowGallery: (show: boolean) => void;
  showGallery: boolean;
  resumeAudio: () => Promise<AudioContext>;
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setCurrentResult: (result: any) => void;
  setIsBanned: (banned: boolean) => void;
}

const CreationDropZone: React.FC<CreationDropZoneProps> = ({
  handleGenerate,
  setPrompt,
  prompt,
  setStatus,
  setLoadingMessage,
  setCooldown,
  cooldown,
  status,
  loadingMessage,
  error,
  showApiKeyPrompt,
  handleSelectApiKey,
  kernelConfig,
  setKernelConfig,
  chaosMode,
  setChaosMode,
  overdrive,
  setOverdrive,
  volume,
  setVolume,
  currentResult,
  history,
  setShowGallery,
  showGallery,
  resumeAudio,
  audioContextRef,
  sidebarOpen,
  setSidebarOpen,
  setCurrentResult,
  setIsBanned,
}) => {
  const [dragonPower, setDragonPower] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      // Handle the dropped file (e.g., read it, process it)
      console.log('File dropped:', file.name);
      // You might want to set the prompt based on the file name or content, or upload it.
      setPrompt(`Analyze and generate content based on file: ${file.name}`);
    }
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      console.log('File selected:', file.name);
      setPrompt(`Analyze and generate content based on file: ${file.name}`);
    }
  };

  const renderStatusMessage = () => {
    switch (status) {
      case GenerationState.GENERATING:
        return <span className="glitch-text text-lg">{loadingMessage || 'GENERATING REALITY...'}</span>;
      case GenerationState.VIDEO_GENERATING:
        return <span className="glitch-text text-lg">{loadingMessage || 'FORGING VISIONS...'}</span>;
      case GenerationState.PLAYING:
        return <span className="glitch-text text-lg">AUDIO PROTOCOL ACTIVE</span>;
      case GenerationState.ERROR:
        return <span className="glitch-text text-lg text-red-500">ERROR: {error}</span>;
      case GenerationState.IDLE:
      default:
        return <span className="glitch-text text-lg">AWAITING COMMAND</span>;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4 text-red-600 ui-font">
      {/* Top Buttons */}
      <div className="flex space-x-4 mb-8">
        <button className="px-6 py-3 neon-border bg-black bg-opacity-70 hover:bg-opacity-90 transition-all glitch-text text-lg">Upload Photo</button>
        <button className="px-6 py-3 neon-border bg-black bg-opacity-70 hover:bg-opacity-90 transition-all glitch-text text-lg">Upload Video</button>
        <button className="px-6 py-3 neon-border bg-black bg-opacity-70 hover:bg-opacity-90 transition-all glitch-text text-lg">Music Gen</button>
        <button className="px-6 py-3 neon-border bg-black bg-opacity-70 hover:bg-opacity-90 transition-all glitch-text text-lg">Video Gen</button>
        <button className="px-6 py-3 neon-border bg-black bg-opacity-70 hover:bg-opacity-90 transition-all glitch-text text-lg">Export</button>
      </div>

      {/* Effects Button */}
      <button className="px-8 py-4 neon-border bg-black bg-opacity-70 hover:bg-opacity-90 transition-all glitch-text text-xl mb-12">
        <span className="glitch-text">Effects</span>
      </button>

      {/* Drop Zone / Prompt Input */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => document.getElementById('fileInput')?.click()}
        className={`relative w-3/4 max-w-2xl h-64 flex flex-col items-center justify-center text-center p-8 mb-12
          bg-cover bg-center rounded-2xl shadow-lg cursor-pointer
          transition-all duration-300 ease-in-out
          ${isDragging ? 'neon-border-active scale-105' : 'neon-border'}
          bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Cracked_obsidian_surface.jpg/800px-Cracked_obsidian_surface.jpg')]`}
        style={{ borderImage: 'url(https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Dragon_fire.jpg/50px-Dragon_fire.jpg) 30 round' }}
      >
        <input
          type="file"
          id="fileInput"
          className="hidden"
          onChange={handleManualUpload}
        />
        <p className="text-4xl dragon-font text-red-600 glitch-text z-10">
          Drop your creation here
        </p>
        <div className="absolute inset-0 bg-black opacity-60 rounded-2xl"></div>
        <div className="absolute bottom-4">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Dragon_fire.jpg/50px-Dragon_fire.jpg" // Small fire animation
            alt="fire"
            className="w-12 h-auto"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* IGNITE Button */}
      <button
        onClick={() => handleGenerate(null, dragonPower)}
        disabled={status === GenerationState.GENERATING || status === GenerationState.VIDEO_GENERATING || cooldown > 0}
        className={`px-12 py-6 neon-border bg-black bg-opacity-70 hover:bg-opacity-90 transition-all glitch-text text-3xl dragon-font
          ${status === GenerationState.GENERATING || status === GenerationState.VIDEO_GENERATING || cooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''}
          relative overflow-hidden group mb-8`}
      >
        <span className="relative z-10 glitch-text">IGNITE</span>
        <div className="absolute inset-0 bg-gradient-to-r from-red-800 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Dragon_fire.jpg/100px-Dragon_fire.jpg" // Large fire animation
            alt="fire"
            className="w-24 h-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            referrerPolicy="no-referrer"
          />
        </div>
      </button>

      {/* Dragon Power Slider */}
      <div className="w-3/4 max-w-2xl flex items-center space-x-4">
        <span className="text-lg glitch-text">Dragon Power</span>
        <input
          type="range"
          min="0"
          max="100"
          value={dragonPower}
          onChange={(e) => setDragonPower(Number(e.target.value))}
          className="w-full h-2 bg-red-900 rounded-lg appearance-none cursor-pointer neon-border"
        />
        <span className="text-lg glitch-text">{dragonPower}</span>
      </div>

      {/* Status/Error Display */}
      <div className="mt-8 text-center">
        {renderStatusMessage()}
      </div>

      {/* API Key Input (if missing) */}
      {showApiKeyPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="neon-border p-8 bg-gray-900 bg-opacity-80 rounded-lg text-center">
            <p className="text-xl mb-4 glitch-text">VEO API KEY REQUIRED</p>
            <p className="text-sm mb-4">Please select a valid paid API key for video generation.</p>
            <button
              onClick={() => handleSelectApiKey()}
              className="px-6 py-3 neon-border bg-red-800 hover:bg-red-600 transition-all glitch-text text-lg"
            >
              Select API Key
            </button>
            <p className="text-xs mt-4">Refer to <a href="ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">billing documentation</a>.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreationDropZone;
