"use client";

import { useRef, useState, useCallback, useEffect } from 'react';
import { objectDetectionService, Detection } from '../services/objectDetection';

interface UseObjectDetectionOptions {
  detectionInterval?: number; // milliseconds
  confidenceThreshold?: number;
  enabled?: boolean;
}

export function useObjectDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  imageRef?: React.RefObject<HTMLImageElement | null>,
  options: UseObjectDetectionOptions = {}
) {
  const {
    detectionInterval = 100, // 10 FPS by default
    confidenceThreshold = 0.25,
    enabled = true
  } = options;

  const [detections, setDetections] = useState<Detection[]>([]);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isDetectingRef = useRef(false);

  // Load the model on mount
  useEffect(() => {
    const loadModel = async () => {
      // Always load model if enabled, regardless of source
      if (!enabled) return;
      
      setIsModelLoading(true);
      setError(null);
      
      try {
        await objectDetectionService.loadModel();
        setIsModelLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load model');
      } finally {
        setIsModelLoading(false);
      }
    };

    loadModel();
  }, [enabled]);

  // Start/stop detection based on enabled state and media availability
  useEffect(() => {
    const video = videoRef.current;
    const image = imageRef?.current;

    if (!enabled || !isModelLoaded || (!video && !image)) {
      stopDetection();
      return;
    }

    const startForVideo = () => {
      if (video && video.readyState >= 2) {
        startDetection();
      } else if (video) {
        video.addEventListener('loadeddata', startDetection, { once: true });
      }
    };

    const startForImage = () => {
      if (image && image.complete && image.naturalWidth > 0) {
        startDetection();
      } else if (image) {
        image.addEventListener('load', startDetection, { once: true });
      }
    };

    if (video) {
      if (video.style.display !== 'none') {
        startForVideo();
      }
    } 
    
    if (image) {
      // Check if image is effectively active (e.g. source is set and not hidden)
      // Since we can't easily check visibility without more props, we'll try to detect if it has a src
      if (image.src && image.style.display !== 'none') {
        startForImage();
      }
    }

    return () => {
      if (video) video.removeEventListener('loadeddata', startDetection);
      if (image) image.removeEventListener('load', startDetection);
      stopDetection();
    };
  }, [enabled, isModelLoaded, videoRef.current, imageRef?.current, videoRef.current?.readyState, imageRef?.current?.src]);

  const startDetection = useCallback(() => {
    if (!enabled || !isModelLoaded || isDetectingRef.current) return;

    setIsDetecting(true);
    isDetectingRef.current = true;

    const detect = async () => {
      if (!isDetectingRef.current) return;

      const video = videoRef.current;
      const image = imageRef?.current;
      let mediaSource: HTMLVideoElement | HTMLImageElement | null = null;

      // Determine active source
      if (video && video.readyState >= 2 && video.style.display !== 'none') {
        mediaSource = video;
      } else if (image && image.complete && image.naturalWidth > 0 && image.style.display !== 'none') {
        mediaSource = image;
      }

      if (!mediaSource) return;

      try {
        // Double-check model is loaded before detection
        if (!objectDetectionService.isModelLoaded()) {
          return; // Silently skip if model not ready
        }

        // Skip detection if media source is not ready
        if (mediaSource instanceof HTMLVideoElement) {
          if (mediaSource.readyState < 2 || mediaSource.paused || mediaSource.seeking) {
            return; // Skip this frame to avoid blocking video
          }
        }

        const results = await objectDetectionService.detectObjects(mediaSource);
        
        // Filter by confidence threshold
        const filteredDetections = results.filter(
          detection => detection.confidence >= confidenceThreshold
        );
        
        setDetections(filteredDetections);
      } catch (err) {
        // Silently skip errors to avoid disrupting video playback
        // Only log occasionally to avoid console spam
        if (Math.random() < 0.01) { // Log 1% of errors
          console.warn('Detection frame skipped due to error');
        }
      }
    };

    // For video, set up non-blocking continuous detection
    if (videoRef.current && videoRef.current.style.display !== 'none') {
      // Use Web Workers approach with setTimeout for non-blocking detection
      const detectLoop = () => {
        if (!isDetectingRef.current) return;
        
        // Run detection asynchronously without blocking video
        detect().catch(err => {
          console.warn('Detection frame skipped:', err);
        });
        
        // Schedule next detection independently of current detection completion
        setTimeout(detectLoop, detectionInterval);
      };
      
      // Start the detection loop with initial delay to let video start
      setTimeout(detectLoop, 100);
    } else {
      // For images, run detection once
      detect();
    }
    
  }, [enabled, isModelLoaded, detectionInterval, confidenceThreshold]);

  const stopDetection = useCallback(() => {
    setIsDetecting(false);
    isDetectingRef.current = false;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setDetections([]);
  }, []);

  // Manual detection trigger
  const detectOnce = useCallback(async () => {
    if (!isModelLoaded) return [];

    const video = videoRef.current;
    const image = imageRef?.current;
    let mediaSource: HTMLVideoElement | HTMLImageElement | null = null;

     if (video && video.readyState >= 2 && video.style.display !== 'none') {
        mediaSource = video;
      } else if (image && image.complete && image.naturalWidth > 0 && image.style.display !== 'none') {
        mediaSource = image;
      }

    if (!mediaSource) return [];

    try {
      const results = await objectDetectionService.detectObjects(mediaSource);
      const filteredDetections = results.filter(
        detection => detection.confidence >= confidenceThreshold
      );
      setDetections(filteredDetections);
      return filteredDetections;
    } catch (err) {
      console.error('Manual detection error:', err);
      return [];
    }
  }, [isModelLoaded, confidenceThreshold]);

  // Clear detections
  const clearDetections = useCallback(() => {
    setDetections([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    detections,
    isModelLoading,
    isModelLoaded,
    isDetecting,
    error,
    detectOnce,
    clearDetections,
    startDetection,
    stopDetection
  };
}
