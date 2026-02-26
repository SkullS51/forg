import React, { useState } from 'react';
import { Upload, Music, Video, Download, Sparkles } from 'lucide-react';

export default function App() {
  const [dragonPower, setDragonPower] = useState(50);
  const [isBanned, setIsBanned] = useState(false);

  const handleIgnite = () => {
    console.log('IGNITE! Dragon Power:', dragonPower);
    // This is where the "Monster" in the mind meets the code
    alert('The forge ignites! Your creation is being forged...');
  };

  if (isBanned) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center p-10 z-[9999]">
        <h1 className="text-9xl font-black text-red-700 animate-pulse">BANNED</h1>
        <p className="text-4xl text-orange-600 mt-8 font-bold">The Dragon caught you stealing. Your account has been permanently removed.</p>
        <p className="text-2xl text-gray-400 mt-16">No appeal. No return.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black overflow-hidden text-white font-bold">
      {/* Dragon Background Overlay */}
      <div className="absolute inset-0 opacity-40 bg-[url('/dragon-bg.jpg')] bg-cover bg-center" />
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-4xl border-4 border-dashed border-orange-700/50 bg-black/60 backdrop-blur-md rounded-3xl p-12 flex flex-col items-center">
          <h1 className="text-6xl md:text-8xl font-black text-red-600 mb-4">DROP CREATION</h1>
          <p className="text-2xl text-orange-400 mb-12">The Dragon awaits your final offering...</p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10 w-full">
            <button className="p-4 bg-gray-900 border-2 border-orange-700 rounded-xl flex flex-col items-center gap-2 hover:bg-red-950">
              <Upload size={24} /> <span>Photo</span>
            </button>
            <button className="p-4 bg-gray-900 border-2 border-orange-700 rounded-xl flex flex-col items-center gap-2 hover:bg-red-950">
              <Upload size={24} /> <span>Video</span>
            </button>
            <button className="p-4 bg-gray-900 border-2 border-orange-700 rounded-xl flex flex-col items-center gap-2 hover:bg-red-950">
              <Music size={24} /> <span>Music</span>
            </button>
            <button className="p-4 bg-gray-900 border-2 border-orange-700 rounded-xl flex flex-col items-center gap-2 hover:bg-red-950">
              <Video size={24} /> <span>Gen</span>
            </button>
            <button className="p-4 bg-gray-900 border-2 border-orange-700 rounded-xl flex flex-col items-center gap-2 hover:bg-red-950">
              <Download size={24} /> <span>Export</span>
            </button>
          </div>

          <div className="w-full max-w-xl">
            <label className="block text-2xl text-orange-500 mb-4">DRAGON POWER</label>
            <input 
              type="range" 
              className="w-full h-4 bg-red-900 rounded-full appearance-none accent-red-500"
              value={dragonPower}
              onChange={(e) => setDragonPower(e.target.value)}
            />
          </div>

          <button 
            onClick={handleIgnite}
            className="mt-12 px-16 py-8 bg-gradient-to-b from-red-600 to-red-950 border-4 border-orange-500 rounded-2xl text-5xl font-black hover:scale-105 transition-transform"
          >
            IGNITE
          </button>
        </div>
      </div>
    </div>
  );
}
