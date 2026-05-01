import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';

// Setup global PIXI for pixi-live2d-display
window.PIXI = PIXI;

const Live2DAvatar = ({ isSpeaking }) => {
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let app;
    let isMounted = true;

    const initLive2D = async () => {
      // Dynamic import to ensure window.PIXI is set before loading the library
      const { Live2DModel } = await import('pixi-live2d-display');

      if (!canvasRef.current || !isMounted) return;

      app = new PIXI.Application({
        view: canvasRef.current,
        autoStart: true,
        backgroundAlpha: 0,
        resizeTo: canvasRef.current.parentElement,
      });

      try {
        const modelUrl = 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/shizuku/shizuku.model.json';
        const model = await Live2DModel.from(modelUrl);
        
        if (!isMounted) {
          model.destroy();
          return;
        }

        modelRef.current = model;
        app.stage.addChild(model);

        // Scale and position
        const updateTransform = () => {
          if (!app?.renderer) return;
          const scaleX = app.renderer.width / model.width;
          const scaleY = app.renderer.height / model.height;
          model.scale.set(Math.min(scaleX, scaleY) * 1.5);
          model.x = app.renderer.width / 2 - (model.width * model.scale.x) / 2;
          model.y = app.renderer.height - (model.height * model.scale.y) + 150;
        };

        updateTransform();
        window.addEventListener('resize', updateTransform);

        // Make avatar look at mouse
        app.stage.interactive = true;
        app.stage.on('pointermove', (e) => {
          model.focus(e.global.x, e.global.y);
        });

        setLoading(false);
      } catch (err) {
        console.error('Live2D Error:', err);
      }
    };

    initLive2D();

    return () => {
      isMounted = false;
      if (app) app.destroy(false, { children: true });
    };
  }, []);

  // Handle Lip-sync
  useEffect(() => {
    if (!modelRef.current || loading) return;

    const model = modelRef.current;
    let talkInterval;

    if (isSpeaking) {
      // Simulate speaking by randomly changing mouth open parameter
      talkInterval = setInterval(() => {
        const val = Math.random() * 0.8;
        model.internalModel.coreModel.setParamFloat('PARAM_MOUTH_OPEN_Y', val);
      }, 100);
      
      // Randomly play tap body motion
      if (Math.random() > 0.5) {
        model.motion('tap_body');
      }
    } else {
      model.internalModel.coreModel.setParamFloat('PARAM_MOUTH_OPEN_Y', 0);
    }

    return () => {
      clearInterval(talkInterval);
      if (model?.internalModel?.coreModel) {
        model.internalModel.coreModel.setParamFloat('PARAM_MOUTH_OPEN_Y', 0);
      }
    };
  }, [isSpeaking, loading]);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-3xl bg-black/40">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-20 h-20 bg-purple-500/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-cyan-500/20 rounded-full blur-xl animate-pulse delay-1000"></div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/50 backdrop-blur-md">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-cyan-400 font-mono tracking-widest text-sm animate-pulse">LOADING AI MODEL...</p>
        </div>
      )}

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover"></canvas>
      
      {/* Floating Status Text */}
      {!loading && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-md border border-white/20 text-sm font-medium flex items-center gap-2 text-white shadow-lg">
          <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse' : 'bg-gray-400'}`}></span>
          {isSpeaking ? 'AI is speaking...' : 'Listening...'}
        </div>
      )}
    </div>
  );
};

export default Live2DAvatar;
