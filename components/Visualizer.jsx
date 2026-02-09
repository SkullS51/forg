

import React, { useRef, useEffect } from 'react';

// VisualizerProps interface removed as part of TS stripping for direct browser execution.

const Visualizer = ({ 
  mediaUrl, mediaType, isActive, bpm, currentPrompt, overdrive, chaosMode,
  enableBloom, bloomIntensity,
  enableChromaticAberration, chromaticAberrationIntensity,
  enableScanlines, scanlineIntensity,
}) => {
  const canvasRef = useRef(null);
  const feedbackCanvasRef = useRef(null);
  const renderCanvasRef = useRef(null); // New offscreen canvas for initial rendering
  const imageRef = useRef(null);
  const requestRef = useRef();
  const GLOW_COLOR = '#ff0000'; // Define a consistent glow color

  // Initialize offscreen canvases
  useEffect(() => {
    if (mediaType === 'image') {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = mediaUrl;
      img.onload = () => { imageRef.current = img; };
    } else {
      imageRef.current = null; // Clear image if it's a video
    }
    
    if (!feedbackCanvasRef.current) {
        feedbackCanvasRef.current = document.createElement('canvas');
        feedbackCanvasRef.current.width = 1024;
        feedbackCanvasRef.current.height = 1024;
    }
    if (!renderCanvasRef.current) {
      renderCanvasRef.current = document.createElement('canvas');
      renderCanvasRef.current.width = 1024;
      renderCanvasRef.current.height = 1024;
    }
  }, [mediaUrl, mediaType]);

  const draw = (time) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) {
        requestRef.current = requestAnimationFrame(draw);
        return;
    }
    const ctx = canvas.getContext('2d', { alpha: false });
    const fCtx = feedbackCanvasRef.current?.getContext('2d', { alpha: false });
    const rCtx = renderCanvasRef.current?.getContext('2d', { alpha: false }); // Render context
    if (!ctx || !fCtx || !rCtx) return;

    const bFreq = (bpm / 60) * (chaosMode ? 16 : 4);
    const pulse = isActive ? (Math.sin(time * 0.001 * bFreq) * 0.5 + 0.5) : 0; // Only pulse when active

    // --- RENDER BASE IMAGE AND FEEDBACK TO OFFSCREEN CANVAS (renderCanvasRef) ---
    rCtx.fillStyle = '#000';
    rCtx.fillRect(0, 0, 1024, 1024);

    // Evolving Feedback Loop
    fCtx.save();
    const zoom = chaosMode ? 1.04 : 1.006;
    const rotate = chaosMode ? (Math.random() - 0.5) * 0.08 : 0.003;
    fCtx.translate(512, 512);
    fCtx.rotate(rotate);
    fCtx.scale(zoom, zoom);
    fCtx.translate(-512, -512);
    fCtx.globalAlpha = chaosMode ? 0.99 : 0.94;
    fCtx.drawImage(canvas, 0, 0); // Use main canvas as source for feedback
    
    if (chaosMode && Math.random() > 0.85) {
        fCtx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        fCtx.fillRect(Math.random()*1024, Math.random()*1024, 400, 5);
    }
    fCtx.restore();

    // Draw main image to renderCanvas
    rCtx.save();
    if (isActive) {
      const shake = (chaosMode ? 120 : 25) * pulse;
      rCtx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      rCtx.globalAlpha = 1.0;
      if (chaosMode) rCtx.filter = `contrast(600%) saturate(4) hue-rotate(${time * 0.5 % 360}deg)`;
      rCtx.drawImage(imageRef.current, 0, 0, 1024, 1024);
      
      rCtx.globalCompositeOperation = chaosMode ? 'difference' : 'screen';
      rCtx.globalAlpha = 0.6 * pulse;
      rCtx.drawImage(imageRef.current, pulse * 60, pulse * 20, 1024, 1024);
    } else {
      rCtx.drawImage(imageRef.current, 0, 0, 1024, 1024);
    }
    rCtx.restore();

    rCtx.save();
    rCtx.globalCompositeOperation = chaosMode ? 'exclusion' : 'screen';
    rCtx.globalAlpha = chaosMode ? 0.95 : 0.45;
    rCtx.drawImage(feedbackCanvasRef.current, 0, 0);
    rCtx.restore();

    if (isActive && Math.random() > (chaosMode ? 0.4 : 0.97)) {
        rCtx.fillStyle = chaosMode ? '#fff' : '#ff0000';
        rCtx.fillRect(0, Math.random()*1024, 1024, Math.random()*15);
    }

    // --- APPLY POST-PROCESSING EFFECTS TO MAIN CANVAS (canvasRef.current) ---
    ctx.fillStyle = '#000'; // Clear main canvas for new draw
    ctx.fillRect(0, 0, 1024, 1024);

    // 1. Chromatic Aberration (if enabled)
    if (enableChromaticAberration) {
      const caIntensity = (chromaticAberrationIntensity / 100) * (chaosMode ? 10 : (overdrive ? 3 : 1)); // Scale intensity
      const offset = caIntensity * 5; // Max 50 pixel offset

      // Red channel
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'hue-rotate(0deg) saturate(1000%)'; // Make it red
      ctx.globalAlpha = 1.0;
      ctx.drawImage(renderCanvasRef.current, offset, 0, 1024, 1024);

      // Green channel
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'hue-rotate(120deg) saturate(1000%)'; // Make it green
      ctx.globalAlpha = 1.0;
      ctx.drawImage(renderCanvasRef.current, -offset, 0, 1024, 1024);

      // Blue channel (draw centered for base)
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'hue-rotate(240deg) saturate(1000%)'; // Make it blue
      ctx.globalAlpha = 1.0;
      ctx.drawImage(renderCanvasRef.current, 0, 0, 1024, 1024);
      ctx.filter = 'none'; // Reset filter
      ctx.globalCompositeOperation = 'source-over'; // Reset blend mode
    } else {
      // If no chromatic aberration, draw the base render directly
      ctx.drawImage(renderCanvasRef.current, 0, 0, 1024, 1024);
    }

    // 2. Bloom (if enabled)
    if (enableBloom) {
      const bloomRadius = (bloomIntensity / 100) * (chaosMode ? 40 : (overdrive ? 15 : 5)); // Max 40px blur
      const bloomAlpha = (bloomIntensity / 100) * 0.8 * (chaosMode ? 2.0 : (overdrive ? 1.5 : 1.0)); // Max 0.8 alpha

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `blur(${bloomRadius}px) brightness(150%) saturate(200%) drop-shadow(0 0 ${bloomRadius/2}px ${GLOW_COLOR})`; // Use drop-shadow for color
      ctx.globalAlpha = bloomAlpha;
      ctx.drawImage(renderCanvasRef.current, 0, 0, 1024, 1024);
      ctx.restore();
    }

    // 3. Scanlines (if enabled)
    if (enableScanlines) {
      const scanlineAlpha = (scanlineIntensity / 100) * 0.2 * (chaosMode ? 2.0 : (overdrive ? 1.5 : 1.0)); // Max 0.4 alpha
      const scanlineDensity = chaosMode ? 3 : (overdrive ? 5 : 8); // Smaller number means more dense

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = scanlineAlpha;
      ctx.fillStyle = GLOW_COLOR;
      for (let i = 0; i < 1024; i += scanlineDensity) {
        ctx.fillRect(0, i, 1024, 1);
      }
      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    if (mediaType === 'image') {
      requestRef.current = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(requestRef.current);
    } else {
      cancelAnimationFrame(requestRef.current); // Stop animation for video
    }
  }, [
    isActive, bpm, overdrive, chaosMode, mediaUrl, mediaType, // Dependencies for original Visualizer
    enableBloom, bloomIntensity, 
    enableChromaticAberration, chromaticAberrationIntensity, 
    enableScanlines, scanlineIntensity,
  ]);

  if (mediaType === 'video') {
    // For video, directly return a video element. No canvas post-processing applied here.
    return React.createElement("video", {
      src: mediaUrl,
      controls: true,
      loop: true,
      autoPlay: true,
      muted: true, // Auto-mute video to prevent immediate loud audio
      className: "w-full h-full object-contain"
    });
  }

  // For image, return the canvas with post-processing
  return React.createElement("canvas", { ref: canvasRef, width: 1024, height: 1024, className: "w-full h-full object-contain" });
};

export default Visualizer;