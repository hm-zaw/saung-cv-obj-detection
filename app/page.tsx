"use client";

import { useState } from "react";
import Header from "./components/Header";
import MainStage from "./components/MainStage";
import SidePanel from "./components/SidePanel";
import Ticker from "./components/Ticker";
import InfoBanner from "./components/InfoBanner";

interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export default function Home() {
  const [detections, setDetections] = useState<Detection[]>([]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Info Banner */}
      <InfoBanner />

      {/* Header */}
      <Header />

      {/* Main Dashboard Content */}
      <main className="flex-1 p-4 sm:p-6">
        <div className="max-w-[1600px] mx-auto">
          {/* Asymmetric Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-[500px]">
            {/* Left 2/3 - Live Feed Stage */}
            <div className="lg:col-span-2">
              <MainStage onDetectionsChange={setDetections} />
            </div>

            {/* Right 1/3 - Data Ledger */}
            <div className="h-full">
              <SidePanel detections={detections} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
