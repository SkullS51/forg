
import React, { useRef, useEffect } from 'react';

// VisualizerProps interface removed as part of TS stripping for direct browser execution.

const Visualizer = ({ imageUrl, isActive, bpm, currentPrompt, overdrive, chaosMode }) => {
  const canvasRef = useRef(null);
  const feedbackCanvasRef = useRef(null);
  const imageRef = useRef(null);
  const requestRef = useRef();

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => { imageRef.current = img; };
    
    if (!feedbackCanvasRef.current) {
        feedbackCanvasRef.current = document.createElement('canvas');
        feedbackCanvasRef.current.width = 1024;
        feedbackCanvasRef.current.height = 1024;
    }
  }, [imageUrl]);

  const draw = (time) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) {
        requestRef.current = requestAnimationFrame(draw);
        return;
    }
    const ctx = canvas.getContext('2d', { alpha: false });
    const fCtx = feedbackCanvasRef.current?.getContext('2d', { alpha: false });
    if (!ctx || !fCtx) return;

    const bFreq = (bpm / 60) * (chaosMode ? 16 : 4);
    const pulse = Math.sin(time * 0.001 * bFreq) * 0.5 + 0.5;

    // EVOLVING FEEDBACK LOOP
    fCtx.save();
    const zoom = chaosMode ? 1.04 : 1.006;
    const rotate = chaosMode ? (Math.random() - 0.5) * 0.08 : 0.003;
    fCtx.translate(512, 512);
    fCtx.rotate(rotate);
    fCtx.scale(zoom, zoom);
    fCtx.translate(-512, -512);
    fCtx.globalAlpha = chaosMode ? 0.99 : 0.94;
    fCtx.drawImage(canvas, 0, 0);
    
    if (chaosMode && Math.random() > 0.85) {
        fCtx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        fCtx.fillRect(Math.random()*1024, Math.random()*1024, 400, 5);
    }
    fCtx.restore();

    // RENDER CORE
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.save();
    if (isActive) {
      const shake = (chaosMode ? 120 : 25) * pulse;
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      ctx.globalAlpha = 1.0;
      if (chaosMode) ctx.filter = `contrast(600%) saturate(4) hue-rotate(${time * 0.5 % 360}deg)`;
      ctx.drawImage(imageRef.current, 0, 0, 1024, 1024);
      
      ctx.globalCompositeOperation = chaosMode ? 'difference' : 'screen';
      ctx.globalAlpha = 0.6 * pulse;
      ctx.drawImage(imageRef.current, pulse * 60, pulse * 20, 1024, 1024);
    } else {
      ctx.drawImage(imageRef.current, 0, 0, 1024, 1024);
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = chaosMode ? 'exclusion' : 'screen';
    ctx.globalAlpha = chaosMode ? 0.95 : 0.45;
    ctx.drawImage(feedbackCanvasRef.current, 0, 0);
    ctx.restore();

    if (isActive && Math.random() > (chaosMode ? 0.4 : 0.97)) {
        ctx.fillStyle = chaosMode ? '#fff' : '#ff0000';
        ctx.fillRect(0, Math.random()*1024, 1024, Math.random()*15);
    }

    requestRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isActive, bpm, overdrive, chaosMode]);

  return React.createElement("canvas", { ref: canvasRef, width: 1024, height: 1024, className: "w-full h-full object-contain" });
};

export default Visualizer;