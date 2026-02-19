"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { DataConnection, MediaConnection } from "peerjs";

export type ConnectionStatus =
  | "idle"
  | "initializing"
  | "waiting"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface SpectralBridgeState {
  // Session management
  sessionId: string | null;
  isHost: boolean;
  
  // Connection status
  status: ConnectionStatus;
  error: string | null;
  
  // Media
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  
  // Connection metrics
  peerCount: number;
  lastPacketTime: number | null;
  
  // Actions
  generateSession: () => void;
  connectToSession: (sessionId: string) => void;
  disconnect: () => void;
  startLocalStream: () => Promise<void>;
  stopLocalStream: () => void;
}

// Generate a unique session ID (alphanumeric, 8 chars)
function generateSessionId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function useSpectralBridge(
  videoRef: React.RefObject<HTMLVideoElement | null>
): SpectralBridgeState {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerCount, setPeerCount] = useState(0);
  const [lastPacketTime, setLastPacketTime] = useState<number | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const mediaConnectionRef = useRef<MediaConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Close media connection
    if (mediaConnectionRef.current) {
      mediaConnectionRef.current.close();
      mediaConnectionRef.current = null;
    }

    // Close data connection
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }

    // Destroy peer
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    // Stop local stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setPeerCount(0);
  }, []);

  // Generate new session (Host mode)
  const generateSession = useCallback(() => {
    cleanup();
    
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setIsHost(true);
    setStatus("initializing");
    setError(null);

    // Initialize PeerJS as host
    const peer = new Peer(`pyinsathikha-host-${newSessionId}`, {
      debug: 2,
    });

    peerRef.current = peer;

    peer.on("open", () => {
      setStatus("waiting");
    });

    peer.on("connection", (conn) => {
      connectionRef.current = conn;
      setPeerCount(1);

      conn.on("open", () => {
        setStatus("connecting");
      });

      conn.on("data", (data: unknown) => {
        setLastPacketTime(Date.now());
        
        if (typeof data === "object" && data !== null) {
          const msg = data as Record<string, unknown>;
          
          if (msg.type === "signal" && msg.event === "ready-to-send") {
            // Mobile is ready to send stream - it will call us
            // We just need to be ready to answer
            setStatus("connecting");
          }
        }
      });

      conn.on("close", () => {
        setStatus("disconnected");
        setPeerCount(0);
      });

      conn.on("error", (err) => {
        setError(`Connection error: ${err.message}`);
        setStatus("error");
      });
    });

    peer.on("call", (call) => {
      // Answer the call (we don't send our stream back in host mode)
      call.answer();

      call.on("stream", (stream) => {
        setRemoteStream(stream);
        setStatus("connected");
        
        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {
            // Autoplay prevented, will need user interaction
          });
        }
      });

      call.on("close", () => {
        setRemoteStream(null);
        setStatus("disconnected");
      });

      call.on("error", (err) => {
        setError(`Media error: ${err.message}`);
        setStatus("error");
      });
    });

    peer.on("error", (err) => {
      if (err.message.includes("unavailable-id")) {
        // ID taken, regenerate
        generateSession();
        return;
      }
      setError(`Peer error: ${err.message}`);
      setStatus("error");
    });
  }, [cleanup, videoRef]);

  // Connect to existing session (Mobile mode)
  const connectToSession = useCallback(
    (targetSessionId: string) => {
      cleanup();

      setSessionId(targetSessionId);
      setIsHost(false);
      setStatus("initializing");
      setError(null);

      // Initialize PeerJS as mobile client
      const peer = new Peer(`pyinsathikha-mobile-${targetSessionId}`, {
        debug: 2,
      });

      peerRef.current = peer;

      peer.on("open", () => {
        // Connect to host
        const conn = peer.connect(`pyinsathikha-host-${targetSessionId}`);
        connectionRef.current = conn;

        conn.on("open", () => {
          setStatus("connecting");
          setPeerCount(1);

          // Signal that we're ready to send
          conn.send({ type: "signal", event: "ready-to-send" });
        });

        conn.on("data", (data: unknown) => {
          setLastPacketTime(Date.now());
        });

        conn.on("close", () => {
          setStatus("disconnected");
          setPeerCount(0);
        });

        conn.on("error", (err) => {
          setError(`Connection error: ${err.message}`);
          setStatus("error");
        });
      });

      // Handle incoming calls from host
      peer.on("call", (call) => {
        // Answer with our local stream (camera)
        if (streamRef.current) {
          call.answer(streamRef.current);
        } else {
          call.answer();
        }

        mediaConnectionRef.current = call;

        call.on("stream", (stream) => {
          // Mobile doesn't need to receive stream typically
          setStatus("connected");
        });

        call.on("close", () => {
          setStatus("disconnected");
        });

        call.on("error", (err) => {
          setError(`Media error: ${err.message}`);
          setStatus("error");
        });
      });

      peer.on("error", (err) => {
        if (err.message.includes("unavailable-id")) {
          // ID taken, try once more
          setTimeout(() => connectToSession(targetSessionId), 1000);
          return;
        }
        setError(`Peer error: ${err.message}`);
        setStatus("error");
      });
    },
    [cleanup]
  );

  // Start local camera stream
  const startLocalStream = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: isHost ? "user" : "environment", // Mobile uses back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false, // No audio needed for this use case
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setLocalStream(stream);

      // Always attach to video element for local camera
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {
          // Autoplay might be blocked, user will need to click play
        });
      }
      
      // Set status to connected for local camera
      setStatus("connected");
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Camera access denied: ${errorMessage}`);
      setStatus("error");
    }
  }, [isHost, videoRef]);

  // Stop local stream
  const stopLocalStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setLocalStream(null);
    setStatus("idle");
    setError(null);
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoRef]);

  // Disconnect everything
  const disconnect = useCallback(() => {
    cleanup();
    setSessionId(null);
    setIsHost(false);
    setStatus("idle");
    setError(null);
    setLastPacketTime(null);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    sessionId,
    isHost,
    status,
    error,
    localStream,
    remoteStream,
    peerCount,
    lastPacketTime,
    generateSession,
    connectToSession,
    disconnect,
    startLocalStream,
    stopLocalStream,
  };
}
