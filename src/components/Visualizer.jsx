import React, { useEffect, useRef } from 'react';

const Visualizer = ({ analyserNode, isPlaying, chaosMode }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!analyserNode || !canvasRef.current || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      analyserNode.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        let barHeight = dataArray[i] / 2;

        // Apply chaos mode effects
        if (chaosMode) {
          barHeight *= (1 + Math.random() * 0.5); // Random height boost
          ctx.fillStyle = `rgb(${Math.floor(barHeight + 100)}, 0, ${Math.floor(255 - barHeight)})`; // Fiery colors
        } else {
          ctx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`; // Red-ish theme
        }

        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isPlaying, chaosMode]);

  return <canvas ref={canvasRef} className="absolute bottom-0 left-0 w-full h-32 z-20 opacity-70"></canvas>;
};

export default Visualizer;
