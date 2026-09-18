import * as mpHands from '@mediapipe/hands';
import * as mpCamera from '@mediapipe/camera_utils';

export interface HandPoint {
  x: number;
  y: number;
  z: number;
}

export interface HandTrackingResults {
  landmarks: HandPoint[] | null;
  thumbTip: HandPoint | null;
  indexTip: HandPoint | null;
  midpoint: HandPoint | null;
  pinchDistance: number;
  isPinching: boolean;
  ndc: { x: number; y: number };
  rawResults: any;
}

export type PinchCallback = (ndc: { x: number; y: number }) => void;
export type ResultsCallback = (results: HandTrackingResults) => void;
export type StatusCallback = (status: { active: boolean; error?: string; fps: number }) => void;

// Safe accessor for MediaPipe constructors across CJS / ESM / Vite environments
function getHandsConstructor() {
  const anyMp = mpHands as any;
  return anyMp.Hands || anyMp.default?.Hands || (typeof window !== 'undefined' && (window as any).Hands);
}

function getCameraConstructor() {
  const anyCam = mpCamera as any;
  return anyCam.Camera || anyCam.default?.Camera || (typeof window !== 'undefined' && (window as any).Camera);
}

export class HandTrackingService {
  private videoElement: HTMLVideoElement | null = null;
  private handsInstance: any = null;
  private cameraInstance: any = null;
  private isRunning: boolean = false;
  private wasPinching: boolean = false;
  private currentNdc: { x: number; y: number } = { x: 0, y: 0 };
  private frameCount: number = 0;
  private lastFpsCalcTime: number = 0;
  private currentFps: number = 0;

  private onPinchStartListeners: Set<PinchCallback> = new Set();
  private onPinchMoveListeners: Set<PinchCallback> = new Set();
  private onPinchEndListeners: Set<PinchCallback> = new Set();
  private onResultsListeners: Set<ResultsCallback> = new Set();
  private onStatusListeners: Set<StatusCallback> = new Set();

  private debugCanvas: HTMLCanvasElement | null = null;

  constructor() {
    this.initVideoElement();
  }

  private initVideoElement(): HTMLVideoElement {
    if (this.videoElement) return this.videoElement;

    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.muted = true;
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '640px';
    video.style.height = '480px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.zIndex = '-1';
    document.body.appendChild(video);
    this.videoElement = video;
    return video;
  }

  public setDebugCanvas(canvas: HTMLCanvasElement | null) {
    this.debugCanvas = canvas;
  }

  public async start(): Promise<boolean> {
    if (this.isRunning) return true;

    try {
      const video = this.initVideoElement();

      // Get Hands constructor
      const HandsClass = getHandsConstructor();
      if (!HandsClass) {
        throw new Error('MediaPipe Hands library could not be loaded.');
      }

      this.handsInstance = new HandsClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      this.handsInstance.setOptions({
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
        maxNumHands: 1,
        selfieMode: true,
      });

      this.handsInstance.onResults((results: any) => this.handleResults(results));

      const CameraClass = getCameraConstructor();
      if (CameraClass) {
        this.cameraInstance = new CameraClass(video, {
          onFrame: async () => {
            if (this.handsInstance && video.readyState >= 2) {
              await this.handsInstance.send({ image: video });
            }
          },
          width: 640,
          height: 480,
        });
        await this.cameraInstance.start();
      } else {
        // Fallback to direct navigator.mediaDevices.getUserMedia
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        video.srcObject = stream;
        await video.play();

        const processFrame = async () => {
          if (!this.isRunning) return;
          if (this.handsInstance && video.readyState >= 2) {
            try {
              await this.handsInstance.send({ image: video });
            } catch (e) {
              // frame drop / catch
            }
          }
          if (this.isRunning) {
            requestAnimationFrame(processFrame);
          }
        };
        requestAnimationFrame(processFrame);
      }

      this.isRunning = true;
      this.lastFpsCalcTime = performance.now();
      this.notifyStatus({ active: true, fps: 0 });
      return true;
    } catch (err: any) {
      console.warn('Hand tracking initialization warning/error:', err);
      this.notifyStatus({ active: false, error: err?.message || 'Camera permission denied or unavailable', fps: 0 });
      return false;
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.cameraInstance && typeof this.cameraInstance.stop === 'function') {
      try {
        this.cameraInstance.stop();
      } catch (e) {
        // ignore
      }
    }
    if (this.videoElement && this.videoElement.srcObject) {
      const stream = this.videoElement.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      this.videoElement.srcObject = null;
    }
    if (this.handsInstance && typeof this.handsInstance.close === 'function') {
      try {
        this.handsInstance.close();
      } catch (e) {
        // ignore
      }
    }
    this.notifyStatus({ active: false, fps: 0 });
  }

  private handleResults(results: any) {
    // Calculate FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsCalcTime >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsCalcTime));
      this.frameCount = 0;
      this.lastFpsCalcTime = now;
      this.notifyStatus({ active: true, fps: this.currentFps });
    }

    let landmarks: HandPoint[] | null = null;
    let thumbTip: HandPoint | null = null;
    let indexTip: HandPoint | null = null;
    let midpoint: HandPoint | null = null;
    let pinchDistance: number = 1.0;
    let isPinching: boolean = false;
    let ndc = { ...this.currentNdc };

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const rawLandmarks = results.multiHandLandmarks[0];
      landmarks = rawLandmarks.map((l: any) => ({ x: l.x, y: l.y, z: l.z }));

      // Landmark 4 = Thumb tip, Landmark 8 = Index tip
      if (rawLandmarks[4] && rawLandmarks[8]) {
        thumbTip = { x: rawLandmarks[4].x, y: rawLandmarks[4].y, z: rawLandmarks[4].z };
        indexTip = { x: rawLandmarks[8].x, y: rawLandmarks[8].y, z: rawLandmarks[8].z };

        // 3D Euclidean distance: d = sqrt((x8 - x4)^2 + (y8 - y4)^2 + (z8 - z4)^2)
        const dx = indexTip.x - thumbTip.x;
        const dy = indexTip.y - thumbTip.y;
        const dz = indexTip.z - thumbTip.z;
        pinchDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Active pinch when d < 0.08
        isPinching = pinchDistance < 0.08;

        // Midpoint coordinates
        const midX = (thumbTip.x + indexTip.x) / 2;
        const midY = (thumbTip.y + indexTip.y) / 2;
        midpoint = { x: midX, y: midY, z: (thumbTip.z + indexTip.z) / 2 };

        // Convert midpoint to NDC space:
        // Xndc = - ( ((x4 + x8)/2) * 2 - 1 )
        // Yndc = - ( ((y4 + y8)/2) * 2 - 1 )
        const xNdc = -(midX * 2 - 1);
        const yNdc = -(midY * 2 - 1);

        // Clamping to [-1, 1]
        ndc = {
          x: Math.max(-1, Math.min(1, xNdc)),
          y: Math.max(-1, Math.min(1, yNdc)),
        };
        this.currentNdc = ndc;
      }
    }

    // Pinch event dispatching
    if (isPinching && !this.wasPinching) {
      this.onPinchStartListeners.forEach((cb) => cb(ndc));
    } else if (isPinching && this.wasPinching) {
      this.onPinchMoveListeners.forEach((cb) => cb(ndc));
    } else if (!isPinching && this.wasPinching) {
      this.onPinchEndListeners.forEach((cb) => cb(ndc));
    }
    this.wasPinching = isPinching;

    const trackingData: HandTrackingResults = {
      landmarks,
      thumbTip,
      indexTip,
      midpoint,
      pinchDistance,
      isPinching,
      ndc,
      rawResults: results,
    };

    this.onResultsListeners.forEach((cb) => cb(trackingData));

    // Render debug visualizer if canvas is connected
    if (this.debugCanvas) {
      this.renderDebugCanvas(this.debugCanvas, results, isPinching, pinchDistance, midpoint);
    }
  }

  // Draw debug video frame and skeleton landmarks
  public renderDebugCanvas(
    canvas: HTMLCanvasElement,
    results: any,
    isPinching: boolean,
    pinchDistance: number,
    midpoint: HandPoint | null
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Draw video feed if ready
    if (this.videoElement && this.videoElement.readyState >= 2) {
      ctx.save();
      // Mirror feed horizontally
      ctx.scale(-1, 1);
      ctx.translate(-width, 0);
      ctx.drawImage(this.videoElement, 0, 0, width, height);
      ctx.restore();

      // Dark futuristic scanline overlay
      ctx.fillStyle = 'rgba(7, 10, 18, 0.4)';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#0a0f18';
      ctx.fillRect(0, 0, width, height);
    }

    if (results?.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const lm = results.multiHandLandmarks[0];

      // Hand skeleton connections
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [5, 9], [9, 10], [10, 11], [11, 12],
        [9, 13], [13, 14], [14, 15], [15, 16],
        [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
      ];

      // Draw connections
      ctx.lineWidth = 2;
      ctx.strokeStyle = isPinching ? 'rgba(62, 207, 142, 0.8)' : 'rgba(77, 158, 255, 0.5)';
      ctx.beginPath();
      for (const [start, end] of connections) {
        if (lm[start] && lm[end]) {
          const sx = (1 - lm[start].x) * width;
          const sy = lm[start].y * height;
          const ex = (1 - lm[end].x) * width;
          const ey = lm[end].y * height;
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
        }
      }
      ctx.stroke();

      // Draw joints
      for (let i = 0; i < lm.length; i++) {
        const p = lm[i];
        const px = (1 - p.x) * width;
        const py = p.y * height;

        ctx.beginPath();
        const isTarget = i === 4 || i === 8;
        ctx.arc(px, py, isTarget ? 6 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isTarget
          ? isPinching
            ? '#3ecf8e'
            : '#f59e0b'
          : '#4d9eff';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw pinch indicator between thumb (4) and index (8)
      if (lm[4] && lm[8]) {
        const x4 = (1 - lm[4].x) * width;
        const y4 = lm[4].y * height;
        const x8 = (1 - lm[8].x) * width;
        const y8 = lm[8].y * height;

        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(x4, y4);
        ctx.lineTo(x8, y8);
        ctx.strokeStyle = isPinching ? '#3ecf8e' : '#f87171';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]);

        // Midpoint circle
        const mx = (x4 + x8) / 2;
        const my = (y4 + y8) / 2;
        ctx.beginPath();
        ctx.arc(mx, my, isPinching ? 10 : 6, 0, Math.PI * 2);
        ctx.fillStyle = isPinching ? 'rgba(62, 207, 142, 0.9)' : 'rgba(245, 158, 11, 0.8)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Distance text
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = isPinching ? '#3ecf8e' : '#e8edf3';
        ctx.fillText(`d: ${pinchDistance.toFixed(3)} ${isPinching ? 'PINCH ACTIVE' : ''}`, mx + 12, my - 6);
      }
    } else {
      // Waiting for hand prompt
      ctx.fillStyle = '#6b8aa8';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Show hand in camera view', width / 2, height / 2);
    }

    ctx.restore();
  }

  // Mouse / simulated fallback for desktop testing or devices without webcam
  public simulatePinchStart(ndc: { x: number; y: number }) {
    this.currentNdc = ndc;
    this.wasPinching = true;
    this.onPinchStartListeners.forEach((cb) => cb(ndc));
  }

  public simulatePinchMove(ndc: { x: number; y: number }) {
    this.currentNdc = ndc;
    if (this.wasPinching) {
      this.onPinchMoveListeners.forEach((cb) => cb(ndc));
    }
  }

  public simulatePinchEnd(ndc: { x: number; y: number }) {
    this.currentNdc = ndc;
    if (this.wasPinching) {
      this.wasPinching = false;
      this.onPinchEndListeners.forEach((cb) => cb(ndc));
    }
  }

  // Subscriptions
  public onPinchStart(cb: PinchCallback): () => void {
    this.onPinchStartListeners.add(cb);
    return () => this.onPinchStartListeners.delete(cb);
  }

  public onPinchMove(cb: PinchCallback): () => void {
    this.onPinchMoveListeners.add(cb);
    return () => this.onPinchMoveListeners.delete(cb);
  }

  public onPinchEnd(cb: PinchCallback): () => void {
    this.onPinchEndListeners.add(cb);
    return () => this.onPinchEndListeners.delete(cb);
  }

  public onResults(cb: ResultsCallback): () => void {
    this.onResultsListeners.add(cb);
    return () => this.onResultsListeners.delete(cb);
  }

  public onStatus(cb: StatusCallback): () => void {
    this.onStatusListeners.add(cb);
    return () => this.onStatusListeners.delete(cb);
  }

  private notifyStatus(status: { active: boolean; error?: string; fps: number }) {
    this.onStatusListeners.forEach((cb) => cb(status));
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const handTracking = new HandTrackingService();
