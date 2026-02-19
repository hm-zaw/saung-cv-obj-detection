"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Radio, AlertCircle, Camera, RefreshCw } from "lucide-react";
import Peer, { DataConnection, MediaConnection } from "peerjs";

type ConnectionStatus = "initializing" | "connecting" | "connected" | "error" | "disconnected";

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
}

export default function MobileCameraPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const mediaConnRef = useRef<MediaConnection | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("initializing");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLandscape, setIsLandscape] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Helper: Add log
  const addLog = (message: string) => {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setLogs((prev) => [
      ...prev.slice(-4),
      { id: uniqueId, timestamp, message },
    ]);
  };

  // Helper: Cleanup
  const cleanup = () => {
    if (mediaConnRef.current) {
      mediaConnRef.current.close();
      mediaConnRef.current = null;
    }
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Orientation detection
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  // Initialize camera and connection
  useEffect(() => {
    if (!sessionId) return;

    const init = async () => {
      addLog("INIT: Requesting camera...");

      // Check if using HTTPS (required for camera on mobile)
      // IMPORTANT: Check this FIRST - on iOS Safari, navigator.mediaDevices is undefined on HTTP
      // TEMP: Allow local network for testing
      if (window.location.protocol !== 'https:' && 
          window.location.hostname !== 'localhost' &&
          !window.location.hostname.startsWith('192.168.') &&
          !window.location.hostname.startsWith('10.') &&
          !window.location.hostname.startsWith('172.')) {
        setError("HTTPS required for camera access. Use https:// or localhost");
        setStatus("error");
        addLog("ERROR: HTTPS required for camera");
        return;
      }

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Camera API not supported. Try Chrome/Firefox/Safari 11+");
        setStatus("error");
        addLog("ERROR: getUserMedia not supported");
        return;
      }

      try {
        // Get camera stream
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        addLog("CAMERA: Stream acquired");

        // Initialize PeerJS
        setStatus("initializing");
        const peerId = `pyinsathikha-mobile-${sessionId}`;

        const peer = new Peer(peerId, { debug: 2 });
        peerRef.current = peer;

        peer.on("open", () => {
          addLog("PEER: Connected to relay");
          setStatus("connecting");

          // Connect to host
          const hostId = `pyinsathikha-host-${sessionId}`;
          const conn = peer.connect(hostId);
          connRef.current = conn;

          conn.on("open", () => {
            addLog("SIGNAL: Control channel open");
            
            // Signal ready and then call the host with our stream
            if (streamRef.current) {
              conn.send({ type: "signal", event: "ready-to-send" });
              
              // Wait a moment for the signal to arrive, then call host
              setTimeout(() => {
                const hostId = `pyinsathikha-host-${sessionId}`;
                const mediaConn = peer.call(hostId, streamRef.current!);
                mediaConnRef.current = mediaConn;
                
                addLog("MEDIA: Calling host...");
                
                mediaConn.on("stream", () => {
                  // We don't need to receive stream on mobile
                });
                
                mediaConn.on("close", () => {
                  setStatus("disconnected");
                  addLog("MEDIA: Connection closed");
                });
                
                mediaConn.on("error", (err) => {
                  setError(`Media error: ${err.message}`);
                  setStatus("error");
                });
                
                // Connection established
                setTimeout(() => {
                  setStatus("connected");
                  addLog("BRIDGE: Stream active");
                }, 500);
              }, 500);
            }
          });

          conn.on("data", (data: unknown) => {
            addLog(`RECV: ${JSON.stringify(data)}`);
          });

          conn.on("close", () => {
            setStatus("disconnected");
            addLog("DISCONNECT: Control lost");
          });

          conn.on("error", (err) => {
            setError(`Signal error: ${err.message}`);
            setStatus("error");
          });
        });

        // We initiate the call to host, don't need to handle incoming calls
        peer.on("call", () => {
          // Ignore incoming calls - we initiate the connection
        });

        peer.on("error", (err) => {
          if (err.message.includes("unavailable-id")) {
            // Retry with new ID
            setTimeout(() => init(), 1000);
            return;
          }
          setError(`Peer error: ${err.message}`);
          setStatus("error");
          addLog(`ERROR: ${err.message}`);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(`Camera access denied: ${msg}`);
        setStatus("error");
        addLog(`ERROR: ${msg}`);
      }
    };

    init();

    return () => {
      cleanup();
    };
  }, [sessionId, facingMode]);

  // Swap camera
  const swapCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    addLog("CAMERA: Switching...");
  };

  // Retry connection
  const retry = () => {
    cleanup();
    setError(null);
    setStatus("initializing");
    setLogs([]);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* Video Feed */}
      <div className="relative flex-1 flex items-center justify-center bg-[#0a0a0a]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${
            isLandscape ? "object-contain" : "object-cover"
          }`}
        />

        {/* Gold corner brackets */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-gold" />
          <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-gold" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-gold" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-gold" />
        </div>

        {/* Center targeting reticle when connected */}
        {status === "connected" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-24 h-24">
              <div className="absolute top-0 left-1/2 w-px h-6 bg-gold -translate-x-1/2" />
              <div className="absolute bottom-0 left-1/2 w-px h-6 bg-gold -translate-x-1/2" />
              <div className="absolute left-0 top-1/2 w-6 h-px bg-gold -translate-y-1/2" />
              <div className="absolute right-0 top-1/2 w-6 h-px bg-gold -translate-y-1/2" />
              <div className="absolute top-1/2 left-1/2 w-2 h-2 border border-gold -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-white font-mono text-center text-sm mb-4">
              {error}
            </p>
            <button
              onClick={retry}
              className="flex items-center gap-2 px-4 py-2 bg-gold text-ink font-mono text-sm border-2 border-gold active:scale-95 transition-transform"
            >
              <RefreshCw className="w-4 h-4" />
              RETRY
            </button>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-16 bg-[#1A1A1A] border-t-2 border-gold flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Radio
            className={`w-5 h-5 ${
              status === "connected"
                ? "text-gold animate-pulse"
                : status === "error"
                ? "text-red-500"
                : "text-amber-600 animate-pulse"
            }`}
          />
          <div className="flex flex-col">
            <span className="font-mono text-xs text-gold uppercase tracking-wider">
              {status === "initializing" && "INITIALIZING..."}
              {status === "connecting" && "LINKING TO CORE..."}
              {status === "connected" && "TRANSMITTING TO CORE"}
              {status === "disconnected" && "CONNECTION LOST"}
              {status === "error" && "SYSTEM ERROR"}
            </span>
            <span className="font-mono text-[10px] text-ink opacity-60">
              SESSION: {sessionId}
            </span>
          </div>
        </div>

        {/* Camera swap button */}
        <button
          onClick={swapCamera}
          className="p-2 bg-gold/20 border border-gold active:scale-95 transition-transform"
        >
          <Camera className="w-5 h-5 text-gold" />
        </button>
      </div>

      {/* Mini Log */}
      <div className="h-24 bg-[#0a0a0a] border-t border-ink p-2 font-mono text-[10px] space-y-1 overflow-hidden">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 text-amber-600/80">
            <span className="opacity-50">{log.timestamp}</span>
            <span>{log.message}</span>
          </div>
        ))}
      </div>

      {/* Hidden canvas for any processing needs */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
