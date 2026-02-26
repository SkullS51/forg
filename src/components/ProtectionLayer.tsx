import React from 'react';

interface ProtectionLayerProps {
  trigger: boolean;
}

const ProtectionLayer: React.FC<ProtectionLayerProps> = ({ trigger }) => {
  if (!trigger) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black bg-opacity-95 text-red-600 ui-font p-4">
      {/* Dragon Head */}
      <img
        src="https://picsum.photos/seed/ban_dragon/800/600" // Placeholder for ban dragon head
        alt="Banned Dragon"
        className="w-64 h-auto mb-8 glitch-text"
        referrerPolicy="no-referrer"
      />

      {/* Ban Message Box */}
      <div className="neon-border bg-black bg-opacity-80 p-8 text-center max-w-lg rounded-lg">
        <h2 className="text-4xl dragon-font mb-4 glitch-text">THE DRAGON CAUGHT YOU STEALING.</h2>
        <p className="text-xl mb-2 glitch-text">Your account has been permanently removed.</p>
        <p className="text-xl mb-4 glitch-text">All creations incinerated. No appeal. No return.</p>
        <div className="mt-6">
          <img
            src="https://picsum.photos/seed/fire_small_ban/80/30" // Small fire animation
            alt="fire"
            className="w-20 h-auto mx-auto glitch-text"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
};

export default ProtectionLayer;
