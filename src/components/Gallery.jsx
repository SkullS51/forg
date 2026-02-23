import React, { useState } from 'react';

const Gallery = ({ history, onClose }) => {
  const [fullscreenImage, setFullscreenImage] = useState(null);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-red-600 text-black px-4 py-2 text-lg hover:bg-white transition-all font-black italic uppercase"
      >
        Close Gallery
      </button>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto max-h-[calc(100vh-100px)]">
        {history.filter(item => item.data.mediaType === 'image').map((item) => (
          <div
            key={item.id}
            className="relative w-full aspect-square bg-gray-900 border-2 border-red-900 cursor-pointer hover:border-red-600 transition-colors"
            onClick={() => setFullscreenImage(item.data.mediaUrl)}
          >
            <img
              src={item.data.mediaUrl}
              alt={item.data.prompt}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs p-2 text-center">
              {item.data.prompt}
            </div>
          </div>
        ))}
      </div>

      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 bg-red-600 text-black px-4 py-2 text-lg hover:bg-white transition-all font-black italic uppercase"
          >
            Close Fullscreen
          </button>
          <img
            src={fullscreenImage}
            alt="Fullscreen Artwork"
            className="max-w-[90vw] max-h-[90vh] object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
};

export default Gallery;
