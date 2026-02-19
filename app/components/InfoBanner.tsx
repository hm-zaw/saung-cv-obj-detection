"use client";

import { useState } from 'react';
import { X, Info } from 'lucide-react';

export default function InfoBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm bg-amber-50 border-2 border-amber-400 p-4 shadow-retro">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-mono text-sm font-bold text-amber-800 mb-1">
            Console Info
          </h3>
          <p className="font-mono text-xs text-amber-700 leading-relaxed">
            "Unknown CPU vendor" warnings in console are <strong>normal</strong> and can be ignored. 
            Your AI detection is working perfectly!
          </p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-amber-600 hover:text-amber-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}