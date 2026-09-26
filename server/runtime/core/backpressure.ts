/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BackpressureBufferOptions {
  highWatermark?: number; // Maximum queued chunks before pausing upstream (default: 32)
  lowWatermark?: number;  // Resume upstream when queue drops below this (default: 8)
  maxBytes?: number;      // Maximum memory payload allowed in buffer (default: 256KB)
}

export class BoundedStreamQueue<T> {
  private queue: T[] = [];
  private highWatermark: number;
  private lowWatermark: number;
  private maxBytes: number;
  private currentBytes: number = 0;
  private isPaused: boolean = false;
  private pauseCount: number = 0;
  private resumeCount: number = 0;
  private drainResolvers: (() => void)[] = [];
  private onBackpressureChange?: (isPaused: boolean, currentSize: number) => void;

  constructor(options?: BackpressureBufferOptions, onBackpressureChange?: (isPaused: boolean, currentSize: number) => void) {
    this.highWatermark = options?.highWatermark ?? 32;
    this.lowWatermark = options?.lowWatermark ?? 8;
    this.maxBytes = options?.maxBytes ?? 262144; // 256 KB
    this.onBackpressureChange = onBackpressureChange;
  }

  public async push(item: T, approximateBytes: number = 128): Promise<boolean> {
    if (this.currentBytes + approximateBytes > this.maxBytes) {
      // Memory limit protection
      throw new Error(`BoundedStreamQueue overflow: buffer exceeded ${this.maxBytes} bytes`);
    }

    this.queue.push(item);
    this.currentBytes += approximateBytes;

    if (this.queue.length >= this.highWatermark && !this.isPaused) {
      this.isPaused = true;
      this.pauseCount++;
      if (this.onBackpressureChange) {
        this.onBackpressureChange(true, this.queue.length);
      }
      // Wait until consumer drains to low watermark
      return new Promise<boolean>((resolve) => {
        this.drainResolvers.push(() => resolve(true));
      });
    }

    return true;
  }

  public shift(): T | undefined {
    const item = this.queue.shift();
    if (!item) return undefined;

    // Approximate byte reduction
    this.currentBytes = Math.max(0, this.currentBytes - 128);

    if (this.isPaused && this.queue.length <= this.lowWatermark) {
      this.isPaused = false;
      this.resumeCount++;
      if (this.onBackpressureChange) {
        this.onBackpressureChange(false, this.queue.length);
      }
      while (this.drainResolvers.length > 0) {
        const resolve = this.drainResolvers.shift();
        if (resolve) resolve();
      }
    }

    return item;
  }

  public get length(): number {
    return this.queue.length;
  }

  public get isBackpressureActive(): boolean {
    return this.isPaused;
  }

  public getStats() {
    return {
      queueLength: this.queue.length,
      currentBytes: this.currentBytes,
      isPaused: this.isPaused,
      pauseCount: this.pauseCount,
      resumeCount: this.resumeCount,
      highWatermark: this.highWatermark,
      lowWatermark: this.lowWatermark,
    };
  }

  public clear(): void {
    this.queue = [];
    this.currentBytes = 0;
    this.isPaused = false;
    while (this.drainResolvers.length > 0) {
      const resolve = this.drainResolvers.shift();
      if (resolve) resolve();
    }
  }
}
