import * as ort from 'onnxruntime-web';
import { LabelItem } from '../types';

export interface InferenceResult {
  topLabel: string;
  topScore: number;
  scores: { [labelId: string]: number };
  latencyMs: number;
}

export class OnnxPipelineRunner {
  private session: ort.InferenceSession | null = null;
  private labels: LabelItem[] = [];
  private isLoaded: boolean = false;
  private isRunning: boolean = false;

  constructor() {}

  public async loadModel(modelPath: string = '/models/dummy_model.onnx', labelsPath: string = '/labels.json'): Promise<void> {
    try {
      // 1. Tải danh sách nhãn
      const res = await fetch(labelsPath);
      this.labels = await res.json();

      // 2. Cấu hình onnxruntime-web WASM
      // Sử dụng WebAssembly execution provider
      ort.env.wasm.numThreads = 1;

      console.log(`[ONNX] Đang tải mô hình từ ${modelPath}...`);
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm']
      });
      this.isLoaded = true;
      console.log('[ONNX] Đã tải mô hình dummy thành công. Input names:', this.session.inputNames);
    } catch (err) {
      console.error('[ONNX] Lỗi tải mô hình:', err);
      throw err;
    }
  }

  public isReady(): boolean {
    return this.isLoaded && this.session !== null;
  }

  public getLabels(): LabelItem[] {
    return this.labels;
  }

  /**
   * Chạy suy luận với chuỗi 30 frames đặc trưng (mỗi frame 272 giá trị)
   * @param sequenceFlatArray Mảng 30 * 272 = 8160 số thực (hoặc mảng 2D)
   */
  public async runInference(sequenceFlatArray: Float32Array): Promise<InferenceResult | null> {
    if (!this.session || this.isRunning) return null;
    this.isRunning = true;

    const start = performance.now();
    try {
      // Input shape: [1, 30, 272]
      const tensor = new ort.Tensor('float32', sequenceFlatArray, [1, 30, 272]);
      const feeds: Record<string, ort.Tensor> = {
        input: tensor
      };

      const results = await this.session.run(feeds);
      const outputTensor = results.probabilities;
      const probs = outputTensor.data as Float32Array;

      // Tìm top label
      let maxScore = -1;
      let maxIdx = 0;
      const scoresMap: { [labelId: string]: number } = {};

      for (let i = 0; i < this.labels.length; i++) {
        const score = probs[i] || 0;
        const labelId = this.labels[i].id;
        scoresMap[labelId] = score;
        if (score > maxScore) {
          maxScore = score;
          maxIdx = i;
        }
      }

      const latencyMs = Math.round(performance.now() - start);
      return {
        topLabel: this.labels[maxIdx]?.name || 'Unknown',
        topScore: maxScore,
        scores: scoresMap,
        latencyMs
      };
    } catch (e) {
      console.error('[ONNX] Lỗi suy luận:', e);
      return null;
    } finally {
      this.isRunning = false;
    }
  }
}

