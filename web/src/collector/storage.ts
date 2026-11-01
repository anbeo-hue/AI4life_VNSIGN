import { RecordedSample } from '../types';

const DB_NAME = 'VSL_AI4Life_Database';
const DB_VERSION = 1;
const STORE_SAMPLES = 'samples';

export class LocalStorageDB {
  private db: IDBDatabase | null = null;

  public async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_SAMPLES)) {
          const store = db.createObjectStore(STORE_SAMPLES, { keyPath: 'id', autoIncrement: true });
          store.createIndex('labelId', 'labelId', { unique: false });
          store.createIndex('signerId', 'signerId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.error('[IndexedDB] Lỗi mở cơ sở dữ liệu:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  /**
   * Lưu một mẫu cử chỉ đã thu thập
   */
  public async saveSample(sample: RecordedSample): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Chưa mở database'));
      const transaction = this.db.transaction([STORE_SAMPLES], 'readwrite');
      const store = transaction.objectStore(STORE_SAMPLES);
      const request = store.add(sample);

      request.onsuccess = () => {
        resolve(request.result as number);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Lấy toàn bộ các mẫu đã lưu
   */
  public async getAllSamples(): Promise<(RecordedSample & { id: number })[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Chưa mở database'));
      const transaction = this.db.transaction([STORE_SAMPLES], 'readonly');
      const store = transaction.objectStore(STORE_SAMPLES);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as (RecordedSample & { id: number })[]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Xóa một mẫu theo ID
   */
  public async deleteSample(id: number): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Chưa mở database'));
      const transaction = this.db.transaction([STORE_SAMPLES], 'readwrite');
      const store = transaction.objectStore(STORE_SAMPLES);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Xóa toàn bộ dữ liệu mẫu trong IndexedDB
   */
  public async clearAll(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('Chưa mở database'));
      const transaction = this.db.transaction([STORE_SAMPLES], 'readwrite');
      const store = transaction.objectStore(STORE_SAMPLES);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Lấy thống kê số lượng mẫu theo từng nhãn
   */
  public async getSampleCountsByLabel(): Promise<{ [labelId: string]: number }> {
    const samples = await this.getAllSamples();
    const counts: { [labelId: string]: number } = {};
    for (const s of samples) {
      counts[s.labelId] = (counts[s.labelId] || 0) + 1;
    }
    return counts;
  }
}

export const dbStorage = new LocalStorageDB();

