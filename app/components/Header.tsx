"use client";

import { Activity } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b-2 border-ink bg-paper px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo / Title Section */}
        <div className="flex items-center gap-4">
          <div className="border-2 border-ink p-2 shadow-retro-sm bg-paper-dark">
            {/* If you want the Burmese name for PyinsaThikha, it is ပဉ္စသိက္ခ */}
            <span className="font-[var(--font-masterpiece)] text-2xl font-bold text-ink tracking-tight">
              PyinsaThikha
            </span>
          </div>
          <div className="hidden sm:block">
            {/* CORRECTED: "Myanmar Harp AI System" */}
            <p className="font-[var(--font-myanmar)] text-sm text-ink opacity-80">
              မြန်မာ့စောင်း အသိဉာဏ်တု စနစ်
            </p>
            <p className="font-mono text-xs mt-1 text-ink opacity-60 uppercase tracking-wider">
              Myanmar Harp Detection System
            </p>
          </div>
        </div>

        {/* System Status */}
        <div className="flex items-center gap-3 border-2 border-ink px-4 py-2 bg-paper-dark shadow-retro-sm gold-shimmer-border">
          <Activity className="w-4 h-4 text-gold animate-blink" />
          <span className="font-mono text-sm text-ink uppercase tracking-wider">
            System Ready
          </span>
          <div className="w-2 h-2 rounded-full bg-gold animate-blink" />
        </div>
      </div>

      {/* Secondary Info Bar */}
      <div className="mt-3 flex items-center gap-6 text-xs font-mono text-ink opacity-70">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider">Model:</span>
          <span className="text-gold font-semibold animate-shimmer" style={{ WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>YOLOv8n-Custom</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider">FPS Target:</span>
          <span>30</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider">Classes:</span>
          <span>21 (6 Object classes)</span>
        </div>
      </div>
    </header>
  );
}
