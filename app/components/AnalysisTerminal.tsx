"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Terminal, Wifi, AlertCircle } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "warn" | "error" | "success";
  message: string;
}

interface AnalysisTerminalProps {
  isStreaming?: boolean;
  fps?: number;
  frameDropped?: number;
  packetStatus?: "idle" | "receiving" | "dropped";
  detectionConfidence?: number;
}

function generateLogEntry(
  type: LogEntry["type"],
  message: string
): LogEntry {
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now
    .getMilliseconds()
    .toString()
    .padStart(3, "0")}`;

  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    type,
    message,
  };
}

export default function AnalysisTerminal({
  isStreaming = false,
  fps = 0,
  frameDropped = 0,
  packetStatus = "idle",
  detectionConfidence = 0,
}: AnalysisTerminalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  // Signal visualizer animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.fillStyle = "#1A1A1A";
      ctx.fillRect(0, 0, width, height);

      // Draw grid lines
      ctx.strokeStyle = "#2A2A2A";
      ctx.lineWidth = 1;
      const gridSize = 20;

      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw signal wave
      timeRef.current += 0.05;
      const centerY = height / 2;

      // Base signal (always present)
      ctx.beginPath();
      ctx.strokeStyle = "#C59D5F";
      ctx.lineWidth = 2;

      for (let x = 0; x < width; x++) {
        const normalizedX = x / width;

        // Complex waveform combining multiple sine waves
        let amplitude = 0;

        if (isStreaming) {
          // Active signal with detection confidence modulation
          const confidenceFactor = 0.3 + detectionConfidence * 0.7;
          const noise = (Math.random() - 0.5) * 0.1;

          amplitude =
            Math.sin(normalizedX * 10 + timeRef.current) *
              0.4 *
              confidenceFactor +
            Math.sin(normalizedX * 20 - timeRef.current * 1.5) *
              0.2 *
              confidenceFactor +
            Math.sin(normalizedX * 5 + timeRef.current * 0.5) *
              0.3 *
              confidenceFactor +
            noise;

          // Add packet drop spikes
          if (packetStatus === "dropped" && Math.random() > 0.9) {
            amplitude *= 2.5;
          }
        } else {
          // Idle noise
          amplitude = (Math.random() - 0.5) * 0.1;
        }

        const y = centerY + amplitude * (height * 0.35);

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      // Draw glow effect
      ctx.shadowColor = "#C59D5F";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw center line
      ctx.beginPath();
      ctx.strokeStyle = "#C59D5F33";
      ctx.lineWidth = 1;
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Draw amplitude bars on sides
      const barCount = 20;
      const barWidth = 3;
      const barGap = (height - 40) / barCount;

      for (let i = 0; i < barCount; i++) {
        const barHeight =
          Math.random() * (isStreaming ? 20 : 5) + (isStreaming ? 10 : 2);
        const y = 20 + i * barGap;

        // Left side bars
        ctx.fillStyle = isStreaming ? "#C59D5F" : "#4A4A4A";
        ctx.fillRect(5, y, barWidth, barHeight);

        // Right side bars (mirrored)
        ctx.fillRect(width - 5 - barWidth, y, barWidth, barHeight);
      }

      // Draw signal strength indicator
      const signalStrength = isStreaming ? 0.7 + Math.random() * 0.3 : 0.1;
      const indicatorWidth = 60;
      const indicatorHeight = 6;
      const indicatorX = width - indicatorWidth - 15;
      const indicatorY = 15;

      ctx.fillStyle = "#2A2A2A";
      ctx.fillRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight);

      ctx.fillStyle = signalStrength > 0.5 ? "#C59D5F" : "#4A4A4A";
      ctx.fillRect(
        indicatorX,
        indicatorY,
        indicatorWidth * signalStrength,
        indicatorHeight
      );

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isStreaming, packetStatus, detectionConfidence]);

  // System log management
  useEffect(() => {
    const newLogs: LogEntry[] = [];

    // Initial logs
    newLogs.push(
      generateLogEntry("info", "SYSTEM: Analysis Terminal initialized")
    );
    newLogs.push(generateLogEntry("info", "SIGNAL_PROC: DSP engine ready"));
    newLogs.push(generateLogEntry("info", "BUFFER: Circular buffer allocated"));

    setLogs(newLogs);

    // Periodic log updates
    const logInterval = setInterval(() => {
      setLogs((prev) => {
        const updates: LogEntry[] = [];

        if (isStreaming) {
          if (Math.random() > 0.7) {
            updates.push(
              generateLogEntry(
                "info",
                `FRAME_PROC: ${fps.toFixed(1)} FPS | CONF: ${(
                  detectionConfidence * 100
                ).toFixed(0)}%`
              )
            );
          }

          if (packetStatus === "receiving" && Math.random() > 0.8) {
            updates.push(
              generateLogEntry("success", "WEBRTC_PACKET: RECV_OK")
            );
          }

          if (packetStatus === "dropped") {
            updates.push(
              generateLogEntry("warn", `FRAME_DROPPED: ${frameDropped}`)
            );
          }

          if (detectionConfidence > 0.9 && Math.random() > 0.9) {
            updates.push(
              generateLogEntry("success", "DETECTION: HIGH_CONFIDENCE_LOCK")
            );
          }
        } else {
          if (Math.random() > 0.8) {
            updates.push(generateLogEntry("info", "SIGNAL: NO_INPUT"));
          }
        }

        const combined = [...prev, ...updates];
        // Keep only last 50 entries
        return combined.slice(-50);
      });
    }, 500);

    return () => clearInterval(logInterval);
  }, [isStreaming, fps, frameDropped, packetStatus, detectionConfidence]);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "error":
        return "text-red-500";
      case "warn":
        return "text-yellow-500";
      case "success":
        return "text-emerald-500";
      default:
        return "text-amber-600";
    }
  };

  const getLogPrefix = (type: LogEntry["type"]) => {
    switch (type) {
      case "error":
        return "[ERR]";
      case "warn":
        return "[WRN]";
      case "success":
        return "[OK]";
      default:
        return "[INFO]";
    }
  };

  return (
    <div className="w-full h-[200px] border-2 border-ink bg-paper-dark shadow-retro overflow-hidden">
      {/* Header Strip */}
      <div className="border-b-2 border-ink bg-paper px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gold" />
          <span className="font-mono text-xs uppercase tracking-wider text-ink">
            Signal Analysis Terminal
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1">
            {isStreaming ? (
              <Wifi className="w-3 h-3 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3 h-3 text-amber-600" />
            )}
            <span
              className={
                isStreaming ? "text-emerald-600" : "text-amber-600 opacity-70"
              }
            >
              {isStreaming ? "LIVE" : "STANDBY"}
            </span>
          </div>
          <span className="text-ink opacity-50">
            FPS: {fps > 0 ? fps.toFixed(0) : "--"}
          </span>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex h-[calc(100%-36px)]">
        {/* Left: Signal Visualizer (70%) */}
        <div className="w-[70%] border-r-2 border-ink relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            style={{ imageRendering: "pixelated" }}
          />

          {/* Overlay Labels */}
          <div className="absolute top-2 left-2 font-mono text-[10px] text-gold opacity-70">
            <div>CH_A: SIGNAL_WAVE</div>
            <div>SR: 44.1kHz</div>
          </div>

          <div className="absolute bottom-2 right-2 font-mono text-[10px] text-gold opacity-70">
            <div>
              DETECTION: {(detectionConfidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Right: System Log (30%) */}
        <div className="w-[30%] bg-[#1A1A1A] flex flex-col">
          {/* Log Header */}
          <div className="border-b border-ink bg-paper-dark px-2 py-1 flex items-center gap-1">
            <Terminal className="w-3 h-3 text-gold" />
            <span className="font-mono text-[10px] uppercase text-ink opacity-70">
              Sys.Log
            </span>
          </div>

          {/* Log Content */}
          <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] leading-tight space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-2">
                <span className="text-ink opacity-40">{log.timestamp}</span>
                <span className={getLogColor(log.type)}>
                  {getLogPrefix(log.type)} {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
