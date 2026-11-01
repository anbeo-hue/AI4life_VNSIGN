export interface CameraOptions {
  videoElement: HTMLVideoElement;
  onFrame?: () => void;
  preferredFacingMode?: 'user' | 'environment';
}

export class CameraManager {
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private facingMode: 'user' | 'environment' = 'user';
  private isMirrored: boolean = true;
  private isRunning: boolean = false;

  constructor(options: CameraOptions) {
    this.video = options.videoElement;
    if (options.preferredFacingMode) {
      this.facingMode = options.preferredFacingMode;
      this.isMirrored = this.facingMode === 'user';
    }
  }

  public async start(): Promise<void> {
    await this.stop();

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: this.facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 60 }
      }
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await new Promise<void>((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(() => resolve());
        };
      });
      this.isRunning = true;
    } catch (err) {
      console.error('Không thể mở camera:', err);
      // Fallback nếu constraints nghiêm ngặt thất bại
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      this.video.srcObject = this.stream;
      await new Promise<void>((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(() => resolve());
        };
      });
      this.isRunning = true;
    }
  }

  public async stop(): Promise<void> {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.isRunning = false;
  }

  public async switchCamera(): Promise<'user' | 'environment'> {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    this.isMirrored = this.facingMode === 'user';
    await this.start();
    return this.facingMode;
  }

  public toggleMirror(): boolean {
    this.isMirrored = !this.isMirrored;
    return this.isMirrored;
  }

  public setMirror(mirrored: boolean): void {
    this.isMirrored = mirrored;
  }

  public getFacingMode(): 'user' | 'environment' {
    return this.facingMode;
  }

  public getIsMirrored(): boolean {
    return this.isMirrored;
  }

  public getVideoWidth(): number {
    return this.video.videoWidth || 640;
  }

  public getVideoHeight(): number {
    return this.video.videoHeight || 480;
  }

  public getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  public isActive(): boolean {
    return this.isRunning && this.video.readyState >= 2;
  }
}

