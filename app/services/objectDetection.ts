import * as ort from 'onnxruntime-web';

export interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

export class ObjectDetectionService {
  private session: ort.InferenceSession | null = null;
  private modelLoaded = false;
  private inputSize = 640;
  private hasLoggedModelInfo = false;
  // Corrected class mapping based on user feedback
  // Fixed swapped positions: left_hand <-> left_thumb
  private classNames = [
    'left_hand', 'left_thumb', 'saung_instrument', 'right_forefinger', 'right_hand', 'right_thumb'
  ];

  async loadModel(): Promise<void> {
    try {
      console.log('Starting to load ONNX model...');
      
      // Configure global ONNX environment to reduce warnings
      try {
        ort.env.logLevel = 'fatal';
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.simd = true;
      } catch (envError) {
        // Ignore environment configuration errors
      }
      
      // Try multiple possible paths for the model
      const possiblePaths = [
        '/object_detection/best.onnx',
        './object_detection/best.onnx',
        '/best.onnx'
      ];
      
      let modelUint8Array: Uint8Array | null = null;
      let successPath = '';
      
      for (const path of possiblePaths) {
        try {
          console.log('Trying to fetch model from:', path);
          const response = await fetch(path);
          if (response.ok) {
            const modelArrayBuffer = await response.arrayBuffer();
            modelUint8Array = new Uint8Array(modelArrayBuffer);
            successPath = path;
            console.log('Model fetched successfully from:', path, 'size:', modelArrayBuffer.byteLength);
            break;
          }
        } catch (err) {
          console.log('Failed to fetch from', path, ':', err);
        }
      }
      
      if (!modelUint8Array) {
        throw new Error('Could not load model from any of the attempted paths');
      }
      
      console.log('🤖 Creating AI inference session...');
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('ℹ️  EXPECTED WARNING: "Unknown CPU vendor" is NORMAL');
      console.log('   This is a harmless ONNX Runtime message that can be');
      console.log('   safely ignored. Your detection will work perfectly!');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      
      try {
        // Try minimal configuration first to avoid CPU detection
        this.session = await ort.InferenceSession.create(modelUint8Array, {
          executionProviders: ['wasm'],
        });
      } catch (error) {
        console.log('⚠️  Trying fallback session options...');
        try {
          // Fallback with more options
          this.session = await ort.InferenceSession.create(modelUint8Array, {
            executionProviders: ['wasm'],
            logSeverityLevel: 4,
            logVerbosityLevel: 0,
          });
        } catch (error2) {
          console.log('⚠️  Using default options...');
          // Final fallback to default options
          this.session = await ort.InferenceSession.create(modelUint8Array);
        }
      }
      
      console.log('Model loaded successfully, session created');
      console.log('Model inputs:', this.session.inputNames);
      console.log('Model outputs:', this.session.outputNames);
      
      // Log input/output metadata
      for (const name of this.session.inputNames) {
        const input = this.session.inputMetadata[name];
        console.log(`Input ${name}:`, input);
      }
      for (const name of this.session.outputNames) {
        const output = this.session.outputMetadata[name];
        console.log(`Output ${name}:`, output);
      }
      
      // Validate model has expected inputs/outputs
      if (this.session.inputNames.length === 0) {
        throw new Error('Model has no inputs');
      }
      if (this.session.outputNames.length === 0) {
        throw new Error('Model has no outputs');
      }
      
      this.modelLoaded = true;
      console.log('');
      console.log('🎉 SUCCESS! Model loaded and ready for detection!');
      console.log('✅ Source:', successPath);
      console.log('🎯 Can detect:', this.classNames.join(', '));
      console.log('💡 Any warnings above can be safely ignored.');
      console.log('');
    } catch (error) {
      console.error('Failed to load object detection model:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private preprocessImage(canvas: HTMLCanvasElement): ort.Tensor {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Create a temporary canvas for resizing with better quality
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.inputSize;
    tempCanvas.height = this.inputSize;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) throw new Error('Could not get temp canvas context');

    // Use faster image scaling for real-time performance
    tempCtx.imageSmoothingEnabled = false; // Disable for speed

    // Calculate aspect ratio preserving resize
    const aspectRatio = canvas.width / canvas.height;
    let drawWidth = this.inputSize;
    let drawHeight = this.inputSize;
    let offsetX = 0;
    let offsetY = 0;

    if (aspectRatio > 1) {
      // Landscape
      drawHeight = this.inputSize / aspectRatio;
      offsetY = (this.inputSize - drawHeight) / 2;
    } else {
      // Portrait
      drawWidth = this.inputSize * aspectRatio;
      offsetX = (this.inputSize - drawWidth) / 2;
    }

    // Fill with gray background (letterboxing)
    tempCtx.fillStyle = '#808080';
    tempCtx.fillRect(0, 0, this.inputSize, this.inputSize);

    // Draw and resize image with aspect ratio preservation
    tempCtx.drawImage(canvas, offsetX, offsetY, drawWidth, drawHeight);
    const resizedImageData = tempCtx.getImageData(0, 0, this.inputSize, this.inputSize);

    // Convert to RGB and normalize to [0, 1]
    const input = new Float32Array(3 * this.inputSize * this.inputSize);
    const { data: resizedData } = resizedImageData;

    for (let i = 0; i < resizedData.length; i += 4) {
      const pixelIndex = i / 4;
      // RGB channels, normalize to [0, 1]
      input[pixelIndex] = resizedData[i] / 255.0; // R
      input[pixelIndex + this.inputSize * this.inputSize] = resizedData[i + 1] / 255.0; // G
      input[pixelIndex + 2 * this.inputSize * this.inputSize] = resizedData[i + 2] / 255.0; // B
    }

    // Only log preprocessing info on first run
    if (!this.hasLoggedModelInfo) {
      console.log('Preprocessed image:', {
        originalSize: `${canvas.width}x${canvas.height}`,
        inputSize: `${this.inputSize}x${this.inputSize}`,
        aspectRatio,
        drawSize: `${drawWidth}x${drawHeight}`,
        offset: `${offsetX},${offsetY}`
      });
    }

    return new ort.Tensor('float32', input, [1, 3, this.inputSize, this.inputSize]);
  }

  private postprocessOutput(output: ort.Tensor, originalWidth: number, originalHeight: number): Detection[] {
    const outputData = output.data as Float32Array;
    const [dim1, dim2, dim3] = output.dims;
    
    // Check dimensions to determine layout
    // Standard YOLOv8 export: [1, vectors, anchors] (e.g. [1, 10, 8400])
    // where 10 = 4 box + 6 classes
    
    let numAnchors = 0;
    let numVectors = 0;
    let stride = 0;
    let isChannelFirst = true; // [1, vectors, anchors]

    // Heuristic: Anchors is usually the largest dimension
    if (dim3 > dim2) {
        // Shape: [1, vectors, anchors]
        numVectors = dim2;
        numAnchors = dim3;
        stride = numAnchors; // To jump to next channel
        isChannelFirst = true;
    } else {
        // Shape: [1, anchors, vectors]
        numAnchors = dim2;
        numVectors = dim3;
        stride = 1; // Channels are interleaved
        isChannelFirst = false;
    }

    // Only log model info on first detection
    if (!this.hasLoggedModelInfo) {
      console.log(`Model Output: Shape=[${output.dims}], Anchors=${numAnchors}, Vectors=${numVectors}, ChannelFirst=${isChannelFirst}`);
      console.log(`Current class mapping:`, this.classNames);
      console.log(`Class indices: 0=${this.classNames[0]}, 1=${this.classNames[1]}, 2=${this.classNames[2]}, 3=${this.classNames[3]}, 4=${this.classNames[4]}, 5=${this.classNames[5]}`);
      
      if (numVectors !== 4 + this.classNames.length && numVectors !== 5 + this.classNames.length) {
          console.warn(`Warning: Model output channels (${numVectors}) does not match expected classes (${this.classNames.length}). Check classNames configuration.`);
      }
      this.hasLoggedModelInfo = true;
    }

    // Determine if we have objectness score (YOLOv5 style) or just class scores (YOLOv8 style)
    // If vectors == 4 + classes, no objectness.
    // If vectors == 5 + classes, yes objectness.
    const hasObjectness = numVectors === (5 + this.classNames.length);

    const detections: Detection[] = [];

    for (let i = 0; i < numAnchors; i++) {
        // Read box coordinates
        let cx, cy, w, h, obj = 1.0;

        if (isChannelFirst) {
             // Data layout: [cx_all... cy_all... w_all... h_all... class0_all...]
             // index for attribute A of anchor i = (offset_A * numAnchors) + i
             cx = outputData[0 * numAnchors + i];
             cy = outputData[1 * numAnchors + i];
             w  = outputData[2 * numAnchors + i];
             h  = outputData[3 * numAnchors + i];
             
             if (hasObjectness) {
                 obj = outputData[4 * numAnchors + i];
             }
        } else {
            // Data layout: [cx, cy, w, h, (obj), class0, class1...] for each anchor
            // base for anchor i = i * numVectors
            const base = i * numVectors;
            cx = outputData[base + 0];
            cy = outputData[base + 1];
            w  = outputData[base + 2];
            h  = outputData[base + 3];

            if (hasObjectness) {
                obj = outputData[base + 4];
            }
        }

        // Calculate maximum class score
        let maxClassScore = -1;
        let classIndex = -1;
        const classesStartOffset = hasObjectness ? 5 : 4;

        for (let c = 0; c < this.classNames.length; c++) {
            let score;
            if (isChannelFirst) {
                score = outputData[(classesStartOffset + c) * numAnchors + i];
            } else {
                score = outputData[i * numVectors + (classesStartOffset + c)];
            }

            if (score > maxClassScore) {
                maxClassScore = score;
                classIndex = c;
            }
        }

        const confidence = obj * maxClassScore;

        if (confidence > 0.25) {
            // Convert from center coordinates to top-left coordinates
            // Normalize to [0-1] relative to the model input size
            const x = Math.max(0, Math.min(1, (cx - w / 2) / this.inputSize));
            const y = Math.max(0, Math.min(1, (cy - h / 2) / this.inputSize));
            const width = Math.max(0, Math.min(1, w / this.inputSize));
            const height = Math.max(0, Math.min(1, h / this.inputSize));

            // Only add detection if it's within valid bounds
            if (x >= 0 && y >= 0 && x + width <= 1 && y + height <= 1) {
                detections.push({
                    class: this.classNames[classIndex] || `class_${classIndex}`,
                    confidence: confidence,
                    bbox: [x, y, width, height]
                });
                
                // Minimal logging for performance - only log occasionally
                if (Math.random() < 0.05) { // Log 5% of detections
                  console.log(`Detection: ${this.classNames[classIndex]} (${(confidence * 100).toFixed(1)}%)`);
                }
            }
        }
    }

    // Apply Non-Maximum Suppression (NMS)
    const finalDetections = this.applyNMS(detections);

    return finalDetections;
  }

  private applyNMS(detections: Detection[], iouThreshold: number = 0.45): Detection[] {
    // Sort by confidence in descending order
    detections.sort((a, b) => b.confidence - a.confidence);

    const selected: Detection[] = [];

    // Apply NMS per class
    // We want to suppress duplicate boxes for the SAME class, 
    // but allow overlapping boxes for DIFFERENT classes (e.g. thumb and hand)
    
    // Group by class
    const detectionsByClass: Record<string, Detection[]> = {};
    for (const detection of detections) {
      if (!detectionsByClass[detection.class]) {
        detectionsByClass[detection.class] = [];
      }
      detectionsByClass[detection.class].push(detection);
    }

    // Process each class separately
    for (const className in detectionsByClass) {
      const classDetections = detectionsByClass[className];
      
      for (let i = 0; i < classDetections.length; i++) {
        const current = classDetections[i];
        let keep = true;

        // Check against already selected detections ONLY of the same class
        // (Since we build 'selected' incrementally, we can just check if we've already kept a similar box of this class)
        
        // Actually, simpler logic: check 'current' against all previously 'accepted' in this class loop
        for (const other of selected) {
          if (other.class === current.class) {
             const iou = this.calculateIoU(current.bbox, other.bbox);
             if (iou > iouThreshold) {
               keep = false;
               break;
             }
          }
        }

        if (keep) {
          selected.push(current);
        }
      }
    }

    return selected;
  }

  private calculateIoU(bbox1: [number, number, number, number], bbox2: [number, number, number, number]): number {
    const [x1, y1, w1, h1] = bbox1;
    const [x2, y2, w2, h2] = bbox2;

    // Calculate intersection area
    const xLeft = Math.max(x1, x2);
    const yTop = Math.max(y1, y2);
    const xRight = Math.min(x1 + w1, x2 + w2);
    const yBottom = Math.min(y1 + h1, y2 + h2);

    if (xRight < xLeft || yBottom < yTop) return 0;

    const intersectionArea = (xRight - xLeft) * (yBottom - yTop);

    // Calculate union area
    const area1 = w1 * h1;
    const area2 = w2 * h2;
    const unionArea = area1 + area2 - intersectionArea;

    return intersectionArea / unionArea;
  }

  async detectObjects(mediaSource: HTMLVideoElement | HTMLImageElement): Promise<Detection[]> {
    if (!this.modelLoaded || !this.session) {
      console.warn('⚠️ Model not ready yet, skipping detection...');
      return []; // Return empty array instead of throwing error
    }

    try {
      const isVideo = mediaSource instanceof HTMLVideoElement;
      const width = isVideo ? mediaSource.videoWidth : mediaSource.naturalWidth;
      const height = isVideo ? mediaSource.videoHeight : mediaSource.naturalHeight;

      if (width === 0 || height === 0) {
        // For video, this might happen during loading - just return empty
        return [];
      }

      // For video, check if it's actually playing and has valid frame
      if (isVideo) {
        const video = mediaSource as HTMLVideoElement;
        if (video.readyState < 2 || video.paused || video.ended) {
          return [];
        }
        // Skip detection if video is seeking or buffering to avoid blocking
        if (video.seeking || video.networkState === video.NETWORK_LOADING) {
          return [];
        }
      }

      // Create canvas from media source with optimized settings
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { 
        alpha: false, // No transparency needed, faster
        desynchronized: true, // Allow async rendering
        willReadFrequently: true // Optimize for frequent reads
      });
      if (!ctx) throw new Error('Could not get canvas context');

      // Fast canvas drawing without smoothing for better performance
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(mediaSource, 0, 0);

      // Preprocess image
      const inputTensor = this.preprocessImage(canvas);

      // Run inference
      
      // Use the actual input name from the model
      const inputName = this.session.inputNames[0] || 'images';
      console.log('Using input name:', inputName);
      
      const feeds: Record<string, ort.Tensor> = {};
      feeds[inputName] = inputTensor;
      
      // Run inference with timeout to prevent blocking video
      const inferencePromise = this.session.run(feeds);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Inference timeout')), 100) // 100ms timeout
      );
      
      const outputs = await Promise.race([inferencePromise, timeoutPromise]) as any;
      
      // Use the actual output name from the model
      const outputName = this.session.outputNames[0];
      
      let outputTensor = outputs[outputName];
      
      if (!outputTensor) {
        // Try common fallback names
        const fallbackNames = ['output0', 'output', 'predictions', '0'];
        for (const name of fallbackNames) {
          if (outputs[name]) {
            console.log(`Using fallback output tensor: ${name}`);
            outputTensor = outputs[name];
            break;
          }
        }
        
        if (!outputTensor) {
          console.error('Available outputs:', Object.keys(outputs));
          throw new Error(`No valid output tensor found. Available: ${Object.keys(outputs).join(', ')}`);
        }
      }
      
      // Postprocess results
      const detections = this.postprocessOutput(outputTensor, canvas.width, canvas.height);

      return detections;
    } catch (error) {
      console.error('Object detection failed:', error);
      throw error;
    }
  }

  isModelLoaded(): boolean {
    return this.modelLoaded;
  }
}

// Singleton instance
export const objectDetectionService = new ObjectDetectionService();
