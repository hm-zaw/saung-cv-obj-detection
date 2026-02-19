"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Wifi,
  WifiOff,
  Smartphone,
  Monitor,
  Copy,
  Check,
  X,
  Globe,
} from "lucide-react";
import { useSpectralBridge } from "../hooks/useSpectralBridge";
import { useObjectDetection } from "../hooks/useObjectDetection";
import AnalysisTerminal from "./AnalysisTerminal";
// import BoundingBox from "./BoundingBox";

function getNetworkUrl(): string {
  if (typeof window === "undefined") return "";

  const envBaseUrl = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL;
  if (envBaseUrl) return envBaseUrl.replace(/\/$/, "");
  
  const hostname = window.location.hostname;
  const port = window.location.port;
  const protocol = window.location.protocol;
  
  // If already using a real IP or domain, use it
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    return `${protocol}//${hostname}${port ? ":" + port : ""}`;
  }
  
  // Return localhost URL with warning - user needs to run on 0.0.0.0
  return `${protocol}//${hostname}${port ? ":" + port : ""}`;
}

type InputSource = "local" | "remote" | "file" | null;

interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
}

interface MainStageProps {
  onDetectionsChange?: (detections: Detection[]) => void;
}

export default function MainStage({ onDetectionsChange }: MainStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null); // New image ref
  const [inputSource, setInputSource] = useState<InputSource>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [detectionConfidence, setDetectionConfidence] = useState(0.98);

  const {
    sessionId,
    status,
    error,
    generateSession,
    disconnect,
    startLocalStream,
    stopLocalStream,
  } = useSpectralBridge(videoRef);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadedFileType, setUploadedFileType] = useState<"image" | "video" | null>(null);

  // Is actively streaming?
  const isStreaming =
    (inputSource === "local" && status !== "error") ||
    (inputSource === "remote" && status === "connected") ||
    inputSource === "file";
  
  const isImageActive = inputSource === "file" && uploadedFileType === "image";

  // Object detection hook
  const {
    detections,
    isModelLoading,
    isModelLoaded,
    isDetecting,
    error: detectionError,
    detectOnce,
  } = useObjectDetection(videoRef, imageRef, {
    enabled: isStreaming,
    detectionInterval: 50, // ~20 FPS - optimal balance between smoothness and performance
    confidenceThreshold: 0.05, // Match internal threshold for local camera
  });

  // Pass detections to parent component
  useEffect(() => {
    if (onDetectionsChange) {
      onDetectionsChange(detections);
    }
  }, [detections, onDetectionsChange]);

  // FPS counter
  useEffect(() => {
    if (!videoRef.current || status !== "connected") return;

    let lastTime = performance.now();
    let frames = 0;

    const countFrame = () => {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frames);
        setFrameCount((prev) => prev + frames);
        frames = 0;
        lastTime = now;
      }
      requestAnimationFrame(countFrame);
    };

    const rafId = requestAnimationFrame(countFrame);
    return () => cancelAnimationFrame(rafId);
  }, [status]);

  // Clear file upload
  const clearFileUpload = useCallback(() => {
    if (uploadedFile) {
      URL.revokeObjectURL(uploadedFile);
      setUploadedFile(null);
      setUploadedFileType(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setInputSource(null);
    if (videoRef.current) {
      videoRef.current.src = "";
    }
    if (imageRef.current) {
      imageRef.current.src = "";
    }
  }, [uploadedFile]);

  // Handle local camera
  const handleLocalCamera = useCallback(async () => {
    if (inputSource === "local") {
      console.log('Stopping local camera...');
      stopLocalStream();
      setInputSource(null);
    } else {
      console.log('Starting local camera...');
      disconnect();
      clearFileUpload();
      setInputSource("local");
      try {
        await startLocalStream();
        console.log('Local camera started successfully');
      } catch (error) {
        console.error('Failed to start local camera:', error);
      }
    }
  }, [inputSource, disconnect, startLocalStream, stopLocalStream, clearFileUpload]);

  // Handle remote camera (Spectral Bridge)
  const handleRemoteCamera = useCallback(() => {
    if (inputSource === "remote") {
      disconnect();
      setInputSource(null);
      setShowQRModal(false);
    } else {
      stopLocalStream();
      clearFileUpload();
      setInputSource("remote");
      generateSession();
      setShowQRModal(true);
    }
  }, [inputSource, disconnect, stopLocalStream, clearFileUpload, generateSession]);

  // Handle file upload (photo/video)
  const handleFileUpload = useCallback((type: "image" | "video") => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === "image" ? "image/*" : "video/*";
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Stop other streams
      stopLocalStream();
      disconnect();
      setInputSource("file");
      
      const url = URL.createObjectURL(file);
      setUploadedFile(url);
      
      const type = file.type.startsWith("video/") ? "video" : "image";
      setUploadedFileType(type);

      // Load the file into appropriate element
      if (type === "video" && videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();
        videoRef.current.play().catch(() => {});
      } else if (type === "image" && imageRef.current) {
        imageRef.current.src = url;
      }
    }
  }, [disconnect, stopLocalStream]);

  // Copy session ID to clipboard
  const copySessionId = useCallback(() => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [sessionId]);

  // Close QR modal
  const closeQRModal = useCallback(() => {
    setShowQRModal(false);
  }, []);

  // Get connection status display
  const getStatusDisplay = () => {
    switch (status) {
      case "connected":
        return { text: "LINK ACTIVE", color: "text-emerald-600", icon: Wifi };
      case "connecting":
        return {
          text: "ESTABLISHING...",
          color: "text-amber-600",
          icon: Wifi,
        };
      case "waiting":
        return { text: "AWAITING REMOTE", color: "text-gold", icon: WifiOff };
      case "error":
        return { text: "CONNECTION ERROR", color: "text-red-600", icon: WifiOff };
      default:
        return { text: "STANDBY", color: "text-ink opacity-50", icon: WifiOff };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  // Packet status for AnalysisTerminal
  const packetStatus: "idle" | "receiving" | "dropped" =
    status === "connected" ? "receiving" : status === "error" ? "dropped" : "idle";

  return (
    <div className="space-y-0">
      {/* Main Stage Container */}
      <div className="relative border-2 border-ink bg-paper-dark shadow-retro overflow-hidden">
        {/* Corner Accents - Decorative Brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-gold z-20 corner-bracket" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-gold z-20 corner-bracket" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-gold z-20 corner-bracket" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-gold z-20 corner-bracket" />

        {/* Header Strip */}
        <div className="border-b-2 border-ink bg-paper px-4 py-2 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-ink opacity-70">
            Live Feed Channel A
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 rec-strobe" />
            <span className="font-mono text-xs uppercase text-red-600">REC</span>
          </div>
        </div>

        {/* Video Container */}
        <div className="relative aspect-video bg-[#2a2a2a] flex items-center justify-center overflow-hidden phosphor-glow">
          {/* Scan Bar Sweep */}
          <div className="scan-bar" />

          {/* Video Element (hidden until streaming or video file) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${
              isStreaming && !isImageActive ? "opacity-100" : "opacity-0"
            } transition-opacity duration-500`}
            style={{ display: isStreaming && !isImageActive ? 'block' : 'none' }}
            onLoadedData={() => {
              console.log('Video loaded and ready for detection');
            }}
          />
          
          {/* Image Element (hidden until image file) */}
          <img
            ref={imageRef}
            className={`absolute inset-0 w-full h-full object-contain bg-black ${
              isStreaming && isImageActive ? "opacity-100" : "opacity-0"
            } transition-opacity duration-500`}
            style={{ display: isStreaming && isImageActive ? 'block' : 'none' }}
            alt="Analysis target"
          />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Placeholder / Standby Screen */}
          {!isStreaming && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1a1a1a]/90">
              {/* Grid background pattern */}
              <div className="absolute inset-0 opacity-5">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern id="standbyGrid" width="60" height="60" patternUnits="userSpaceOnUse">
                      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#C59D5F" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#standbyGrid)" />
                </svg>
              </div>

              {/* Main Panel */}
              <div className="relative border-2 border-gold/60 bg-paper-dark/95 p-8 shadow-[0_0_40px_rgba(197,157,95,0.15)]">
                {/* Corner accents */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-gold" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-gold" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-gold" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-gold" />

                {/* Header */}
                <div className="text-center mb-8">
                  <div className="font-mono text-black/80 text-[10px] tracking-[0.3em] uppercase mb-2">
                    // Input Selection Module
                  </div>
                  <div className="font-mono text-black text-lg tracking-wider uppercase border-b border-gold/30 pb-2">
                    Select Source
                  </div>
                </div>

                {/* Buttons Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleFileUpload("image")}
                    className="group relative w-32 h-28 border-2 border-ink bg-paper hover:border-gold transition-all duration-200"
                  >
                    {/* Button inner glow on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-gold/10 to-transparent" />
                    
                    <div className="relative h-full flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full border-2 border-ink group-hover:border-gold flex items-center justify-center transition-colors bg-paper-dark">
                        <svg className="w-6 h-6 text-ink group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink group-hover:text-gold transition-colors">
                        Photo
                      </span>
                    </div>
                    
                    {/* LED indicator */}
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-ink/30 group-hover:bg-gold group-hover:shadow-[0_0_6px_rgba(197,157,95,0.8)] transition-all" />
                  </button>

                  <button
                    onClick={() => handleFileUpload("video")}
                    className="group relative w-32 h-28 border-2 border-ink bg-paper hover:border-gold transition-all duration-200"
                  >
                    {/* Button inner glow on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-gold/10 to-transparent" />
                    
                    <div className="relative h-full flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full border-2 border-ink group-hover:border-gold flex items-center justify-center transition-colors bg-paper-dark">
                        <svg className="w-6 h-6 text-ink group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink group-hover:text-gold transition-colors">
                        Video
                      </span>
                    </div>
                    
                    {/* LED indicator */}
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-ink/30 group-hover:bg-gold group-hover:shadow-[0_0_6px_rgba(197,157,95,0.8)] transition-all" />
                  </button>

                  <button
                    onClick={handleLocalCamera}
                    className="group relative w-32 h-28 border-2 border-ink bg-paper hover:border-gold transition-all duration-200"
                  >
                    {/* Button inner glow on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-gold/10 to-transparent" />
                    
                    <div className="relative h-full flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full border-2 border-ink group-hover:border-gold flex items-center justify-center transition-colors bg-paper-dark">
                        <svg className="w-6 h-6 text-ink group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink group-hover:text-gold transition-colors">
                        Local Cam
                      </span>
                    </div>
                    
                    {/* LED indicator */}
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-ink/30 group-hover:bg-gold group-hover:shadow-[0_0_6px_rgba(197,157,95,0.8)] transition-all" />
                  </button>

                  <button
                    onClick={handleRemoteCamera}
                    className="group relative w-32 h-28 border-2 border-ink bg-paper hover:border-gold transition-all duration-200"
                  >
                    {/* Button inner glow on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-gold/10 to-transparent" />
                    
                    <div className="relative h-full flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full border-2 border-ink group-hover:border-gold flex items-center justify-center transition-colors bg-paper-dark">
                        <svg className="w-6 h-6 text-ink group-hover:text-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink group-hover:text-gold transition-colors">
                        Remote Cam
                      </span>
                    </div>
                    
                    {/* LED indicator */}
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-ink/30 group-hover:bg-gold group-hover:shadow-[0_0_6px_rgba(197,157,95,0.8)] transition-all" />
                  </button>
                </div>

                {/* Footer text */}
                <div className="text-center mt-6">
                  <div className="font-mono text-[9px] text-ink/80 tracking-wider uppercase">
                    Or select input from control strip below
                  </div>
                  {/* Test buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        // Load test image
                        stopLocalStream();
                        disconnect();
                        setInputSource("file");
                        setUploadedFileType("image");
                        
                        const testUrl = "/cv_test.jpeg";
                        setUploadedFile(testUrl);
                        
                        if (imageRef.current) {
                          imageRef.current.src = testUrl;
                        }
                      }}
                      className="px-4 py-2 bg-gold/20 border border-gold text-ink font-mono text-xs hover:bg-gold/30 transition-colors"
                    >
                      LOAD TEST IMAGE
                    </button>
                    
                    {isModelLoaded && inputSource === "local" && (
                      <button
                        onClick={() => {
                          console.log('Manual detection triggered');
                          detectOnce();
                        }}
                        className="px-4 py-2 bg-emerald-600/20 border border-emerald-600 text-ink font-mono text-xs hover:bg-emerald-600/30 transition-colors"
                      >
                        RUN DETECTION
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {inputSource === "file" && (
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-black/60 px-3 py-1.5 border border-gold/50">
              <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-mono text-xs uppercase text-gold">
                FILE UPLOAD
              </span>
              <button
                onClick={clearFileUpload}
                className="ml-2 p-1 hover:bg-white/10"
                title="Clear"
              >
                <X className="w-3 h-3 text-gold" />
              </button>
            </div>
          )}

          {/* Debug Panel - Hidden */}
          {false && (
            <div className="absolute top-4 left-4 z-30 bg-black/80 px-3 py-2 border border-gold/50 font-mono text-xs text-gold max-w-xs">
              <div>Model: {isModelLoading ? 'Loading...' : isModelLoaded ? 'Loaded ✓' : 'Not Loaded'}</div>
              {detectionError && <div className="text-red-400">Error: {detectionError}</div>}
              <div>Detecting: {isDetecting ? 'Yes' : 'No'}</div>
              <div>Detections: {detections.length}</div>
              {detections.length > 0 && (
                <div className="text-xs">Classes: {detections.map(d => `${d.class}(${(d.confidence*100).toFixed(0)}%)`).join(', ')}</div>
              )}
              <div className="text-xs opacity-60">Input: {inputSource || 'None'}</div>
            </div>
          )}

          {/* Connection Status Overlay */}
          {inputSource === "remote" && (
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-black/60 px-3 py-1.5 border border-gold/50">
              <StatusIcon className={`w-4 h-4 ${statusDisplay.color}`} />
              <span
                className={`font-mono text-xs uppercase ${statusDisplay.color}`}
              >
                {statusDisplay.text}
              </span>
            </div>
          )}

          {/* Overlay Layer for Bounding Boxes (only show when streaming) */}
          {isStreaming && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {/* Render detected objects */}
              {detections.map((detection, index) => {
                // Convert normalized coordinates [0-1] to percentage coordinates [0-100]
                const [x, y, width, height] = detection.bbox;
                const svgX = x * 100;
                const svgY = y * 100;
                const svgWidth = width * 100;
                const svgHeight = height * 100;

                // Color mapping with better visibility
                const colors: Record<string, string> = {
                  'right_thumb': '#FF4444', // Bright Red
                  'right_forefinger': '#44FF44', // Bright Green
                  'right_hand': '#4444FF', // Bright Blue
                  'left_thumb': '#FFFF44', // Bright Yellow
                  'left_hand': '#44FFFF', // Bright Cyan
                  'saung_instrument': '#FF44FF', // Bright Magenta
                  'default': '#FFFFFF' // White
                };
                
                const boxColor = colors[detection.class] || colors['default'];

                return (
                  <g key={`${detection.class}-${index}`}>
                    {/* Main bounding box */}
                    <rect
                      x={svgX}
                      y={svgY}
                      width={svgWidth}
                      height={svgHeight}
                      fill="none"
                      stroke={boxColor}
                      strokeWidth="0.5"
                      opacity="0.9"
                    />
                    {/* Label background */}
                    <rect
                      x={svgX}
                      y={Math.max(0, svgY - 4)}
                      width={Math.min(svgWidth, 25)}
                      height="4"
                      fill={boxColor}
                      opacity="0.8"
                    />
                    {/* Label text */}
                    <text
                      x={svgX + 0.5}
                      y={Math.max(3, svgY - 0.5)}
                      fill="black"
                      fontSize="2.5"
                      fontWeight="bold"
                      fontFamily="Arial, sans-serif"
                    >
                      {detection.class} {(detection.confidence * 100).toFixed(0)}%
                    </text>
                  </g>
                );
              })}               {/* Show loading indicator */}
              {isModelLoading && (
                <g>
                  <text
                    x="320"
                    y="170"
                    textAnchor="middle"
                    fontFamily="var(--font-jetbrains-mono), monospace"
                    fontSize="12"
                    fill="#C59D5F"
                    className="animate-pulse"
                  >
                    Loading AI Model...
                  </text>
                  <text
                    x="320"
                    y="190"
                    textAnchor="middle"
                    fontFamily="var(--font-jetbrains-mono), monospace"
                    fontSize="8"
                    fill="#C59D5F"
                    opacity="0.6"
                  >
                    (Console warnings are normal)
                  </text>
                </g>
              )}

              {/* Show detection error */}
              {detectionError && (
                <text
                  x="320"
                  y="180"
                  textAnchor="middle"
                  fontFamily="var(--font-jetbrains-mono), monospace"
                  fontSize="10"
                  fill="#ff6b6b"
                >
                  Detection Error: {detectionError}
                </text>
              )}

              {/* Show no detections message */}
              {!isModelLoading && isModelLoaded && detections.length === 0 && isDetecting && (
                <text
                  x="50"
                  y="50"
                  textAnchor="middle"
                  fontFamily="var(--font-jetbrains-mono), monospace"
                  fontSize="3"
                  fill="#C59D5F"
                  opacity="0.6"
                >
                  Scanning for objects...
                </text>
              )}

              {/* Debug info */}
              {detections.length > 0 && (
                <text
                  x="2"
                  y="95"
                  fontFamily="var(--font-jetbrains-mono), monospace"
                  fontSize="2"
                  fill="#C59D5F"
                  opacity="0.8"
                >
                  Detected: {detections.length} objects
                </text>
              )}
            </svg>
          )}

          {/* Grid Overlay on Video */}
          <div className="absolute inset-0 pointer-events-none opacity-20 z-10">
            <svg width="100%" height="100%">
              <defs>
                <pattern
                  id="videoGrid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#C59D5F"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#videoGrid)" />
            </svg>
          </div>
        </div>

        {/* Bottom Info Strip */}
        <div className="border-t-2 border-ink bg-paper px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 font-mono text-xs text-ink opacity-70">
            <span>RES: 640x360</span>
            <span>FPS: {fps > 0 ? fps.toFixed(0) : "--"}</span>
            <span>FRAMES: {frameCount}</span>
          </div>
          <div className="font-mono text-xs text-gold uppercase tracking-wider">
            {inputSource === "local"
              ? "LOCAL CAMERA"
              : inputSource === "remote"
              ? "SPECTRAL BRIDGE"
              : inputSource === "file"
              ? "FILE UPLOAD"
              : "Overlay Active"}
          </div>
        </div>

        {/* Input Source Selection Strip */}
        <div className="border-t-2 border-ink bg-paper-dark px-4 py-3 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-xs uppercase text-ink opacity-50">
            INPUT SOURCE:
          </span>

          <button
            onClick={handleLocalCamera}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase border-2 transition-all ${
              inputSource === "local"
                ? "bg-gold border-gold text-ink shadow-retro-sm"
                : "border-ink text-ink hover:bg-paper"
            }`}
          >
            <Monitor className="w-4 h-4" />
            LOCAL
          </button>

          <button
            onClick={handleRemoteCamera}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase border-2 transition-all ${
              inputSource === "remote"
                ? "bg-gold border-gold text-ink shadow-retro-sm"
                : "border-ink text-ink hover:bg-paper"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            REMOTE
          </button>

          <button
            onClick={() => handleFileUpload("image")}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase border-2 transition-all ${
              inputSource === "file"
                ? "bg-gold border-gold text-ink shadow-retro-sm"
                : "border-ink text-ink hover:bg-paper"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            PHOTO
          </button>

          <button
            onClick={() => handleFileUpload("video")}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase border-2 transition-all ${
              inputSource === "file"
                ? "bg-gold border-gold text-ink shadow-retro-sm"
                : "border-ink text-ink hover:bg-paper"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            VIDEO
          </button>

          {inputSource === "remote" && sessionId && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="font-mono text-xs text-ink opacity-60">
                SESSION:
              </span>
              <code className="font-mono text-xs bg-paper px-2 py-1 border border-ink text-gold">
                {sessionId}
              </code>
              <button
                onClick={copySessionId}
                className="p-1 hover:bg-paper border border-ink"
                title="Copy Session ID"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && sessionId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-paper border-2 border-ink shadow-retro max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="border-b-2 border-ink bg-paper-dark px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-gold" />
                <span className="font-mono text-sm uppercase text-ink">
                  Spectral Bridge
                </span>
              </div>
              <button
                onClick={closeQRModal}
                className="p-1 hover:bg-paper"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col items-center">
              <p className="font-mono text-xs text-ink opacity-70 text-center mb-4">
                Scan this QR code with your mobile device to use it as the camera
                source.
              </p>

              {/* QR Code */}
              <div className="bg-white p-4 border-2 border-ink shadow-retro-sm mb-4">
                <QRCodeSVG
                  value={`${getNetworkUrl()}/mobile-cam/${sessionId}`}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Network Warning */}
              {typeof window !== "undefined" && window.location.hostname === "localhost" && (
                <div className="w-full bg-amber-100 border-2 border-amber-600 p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <Globe className="w-4 h-4 text-amber-700 mt-0.5" />
                    <div className="text-xs font-mono text-amber-800">
                      <p className="font-bold">NETWORK REQUIRED</p>
                      <p>Your phone cannot access localhost.</p>
                      <p className="mt-1">Run: <code className="bg-amber-200 px-1">npm run dev -- -H 0.0.0.0</code></p>
                      <p className="mt-1">Then use your computer&apos;s IP: <code className="bg-amber-200 px-1">http://192.168.x.x:3000</code></p>
                    </div>
                  </div>
                </div>
              )}

              {/* Session ID Display */}
              <div className="w-full bg-paper-dark border-2 border-ink p-3 mb-4">
                <span className="font-mono text-xs uppercase text-ink opacity-50 block mb-1">
                  Session ID
                </span>
                <div className="flex items-center justify-between">
                  <code className="font-mono text-lg text-gold tracking-wider">
                    {sessionId}
                  </code>
                  <button
                    onClick={copySessionId}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gold text-ink font-mono text-xs border-2 border-gold hover:brightness-110 transition-all"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" />
                        COPIED
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        COPY
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="w-full space-y-2 font-mono text-xs text-ink opacity-70">
                <p>1. Open camera app on your phone</p>
                <p>2. Scan the QR code above</p>
                <p>3. Grant camera permissions</p>
                <p>4. Wait for connection</p>
              </div>

              {/* Status */}
              <div className="w-full mt-4 pt-4 border-t-2 border-ink">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-4 h-4 ${statusDisplay.color}`} />
                  <span
                    className={`font-mono text-xs uppercase ${statusDisplay.color}`}
                  >
                    {statusDisplay.text}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Terminal - Below MainStage */}
      {/* <AnalysisTerminal
        isStreaming={isStreaming}
        fps={fps}
        frameDropped={status === "error" ? 1 : 0}
        packetStatus={packetStatus}
        detectionConfidence={detectionConfidence}
      /> */}

      {/* How to Use - System Manual */}
      <section className="w-full mt-12 p-16 relative">
        {/* Decorative "Cut Here" Line */}
        <div className="w-full flex items-center gap-4 mb-6 p-6 opacity-50">
          <div className="h-px bg-ink flex-1 border-t-2 border-dashed border-ink"></div>
          <span className="font-mono text-xs text-ink uppercase tracking-widest">System Manual / အသုံးပြုနည်း</span>
          <div className="h-px bg-ink flex-1 border-t-2 border-dashed border-ink"></div>
        </div>

        <div className="bg-paper border-l-4 border-gold pl-6 md:pl-10 py-4 relative">
          {/* Main English Header */}
          <h2 className="font-mono text-2xl md:text-3xl text-ink mb-2 uppercase tracking-wide">
            How to Use
          </h2>

          {/* Sub Header (Burmese) */}
          <p className="font-mono text-lg text-ink opacity-60 mb-8">
            အသုံးပြုနည်းလမ်းညွှန်
          </p>

          {/* The Grid of Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
            <div className="relative group min-h-[100px] cursor-default">
              <div className="absolute left-0 -top-2 text-6xl font-mono text-ink/10 select-none z-0 transition-colors duration-300 group-hover:text-gold/20">
                ၁
              </div>
              <div className="relative z-10 pl-16 pt-1">
                <h3 className="font-mono text-lg font-bold text-ink mb-2 flex items-center gap-2 transition-colors duration-300 group-hover:text-gold">
                  ကင်မရာရွေးချယ်ခြင်း
                </h3>
                <p className="font-mono text-ink/70 leading-relaxed text-sm">
                  LOCAL (ကွန်ပျူတာ ကင်မရာ) သို့မဟုတ် REMOTE (ဖုန်းကင်မရာ) နှစ်မျိုးအနက်မှ တစ်ခုခုကို ရွေးချယ်ပါ။
                </p>
              </div>
            </div>

            <div className="relative group min-h-[100px] cursor-default">
              <div className="absolute left-0 -top-2 text-6xl font-mono text-ink/10 select-none z-0 transition-colors duration-300 group-hover:text-gold/20">
                ၂
              </div>
              <div className="relative z-10 pl-16 pt-1">
                <h3 className="font-mono text-lg font-bold text-ink mb-2 flex items-center gap-2 transition-colors duration-300 group-hover:text-gold">
                  Remote Camera ချိတ်ဆက်ခြင်း
                </h3>
                <p className="font-mono text-ink/70 leading-relaxed text-sm">
                  REMOTE ရွေးပါက QR Code ပေါ်လာမည်။ ဖုန်းဖြင့် Scan၍ ကင်မရာခွင့်ပြုချက်ပေးပါ။
                </p>
              </div>
            </div>

            <div className="relative group min-h-[100px] cursor-default">
              <div className="absolute left-0 -top-2 text-6xl font-mono text-ink/10 select-none z-0 transition-colors duration-300 group-hover:text-gold/20">
                ၃
              </div>
              <div className="relative z-10 pl-16 pt-1">
                <h3 className="font-mono text-lg font-bold text-ink mb-2 flex items-center gap-2 transition-colors duration-300 group-hover:text-gold">
                  Object Detection စတင်ခြင်း
                </h3>
                <p className="font-mono text-ink/70 leading-relaxed text-sm">
                  ကင်မရာအမြင်ဧရိယာတွင် လက်များ၊ အရာဝတ္ထုများကို မြှင့်ပြပါ။ Bounding Box နှင့် Label မြင်ရပါမည်။
                </p>
              </div>
            </div>

            <div className="relative group min-h-[100px] cursor-default">
              <div className="absolute left-0 -top-2 text-6xl font-mono text-ink/10 select-none z-0 transition-colors duration-300 group-hover:text-gold/20">
                ၄
              </div>
              <div className="relative z-10 pl-16 pt-1">
                <h3 className="font-mono text-lg font-bold text-ink mb-2 flex items-center gap-2 transition-colors duration-300 group-hover:text-gold">
                  Disconnected ဖြစ်လျှင်
                </h3>
                <p className="font-mono text-ink/70 leading-relaxed text-sm">
                  connection ပြန်လည်တည်ဆောက်ရန် ကင်မရာရွေးချယ်မှု ခလုပ်ကို ပြန်နှိပ်ပါ (Toggle)။
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="mt-8 text-center font-mono text-[10px] text-ink/40 uppercase tracking-[0.2em]">
          © 2025 SAUNG CV // SYSTEM VER. 1.0 // YANGON SERVER
        </div>
      </section>
    </div>
  );
}
