/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CircuitBreakerState } from './types.ts';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number; // Number of consecutive failures before opening (default: 3)
  recoveryTimeMs?: number;   // Time in OPEN state before transitioning to HALF_OPEN (default: 5000ms)
  halfOpenMaxCalls?: number; // Number of probe calls allowed in HALF_OPEN (default: 2)
  backoffBaseMs?: number;    // Exponential backoff base (default: 1000ms)
  backoffMaxMs?: number;     // Exponential backoff max cap (default: 30000ms)
  onStateChange?: (name: string, from: CircuitBreakerState, to: CircuitBreakerState) => void;
}

export class CircuitBreaker {
  public readonly name: string;
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private halfOpenCalls: number = 0;
  private nextAttempt: number = 0;
  private consecutiveTrips: number = 0;
  private readonly failureThreshold: number;
  private readonly recoveryTimeMs: number;
  private readonly halfOpenMaxCalls: number;
  private readonly backoffBaseMs: number;
  private readonly backoffMaxMs: number;
  private readonly onStateChange?: (name: string, from: CircuitBreakerState, to: CircuitBreakerState) => void;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.recoveryTimeMs = options.recoveryTimeMs ?? 5000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 2;
    this.backoffBaseMs = options.backoffBaseMs ?? 1000;
    this.backoffMaxMs = options.backoffMaxMs ?? 30000;
    this.onStateChange = options.onStateChange;
  }

  public getState(): CircuitBreakerState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now >= this.nextAttempt) {
        this.transitionTo('HALF_OPEN');
      }
    }
    return this.state;
  }

  public isAvailable(): boolean {
    const currentState = this.getState();
    if (currentState === 'CLOSED') {
      return true;
    }
    if (currentState === 'HALF_OPEN') {
      return this.halfOpenCalls < this.halfOpenMaxCalls;
    }
    return false;
  }

  public recordSuccess(): void {
    const currentState = this.getState();
    this.successCount++;

    if (currentState === 'HALF_OPEN') {
      this.failureCount = 0;
      this.consecutiveTrips = 0;
      this.transitionTo('CLOSED');
    } else if (currentState === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  public recordFailure(): void {
    this.failureCount++;

    if (this.state === 'HALF_OPEN') {
      this.trip();
    } else if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      this.trip();
    }
  }

  private trip(): void {
    this.consecutiveTrips++;
    // Full jitter exponential backoff: jitter * min(max, base * 2^trips)
    const exp = Math.min(this.backoffMaxMs, this.backoffBaseMs * Math.pow(2, this.consecutiveTrips - 1));
    const jitter = 0.5 + Math.random() * 0.5; // 50% - 100% jitter
    const delay = Math.round(exp * jitter);

    this.nextAttempt = Date.now() + Math.max(this.recoveryTimeMs, delay);
    this.halfOpenCalls = 0;
    this.transitionTo('OPEN');
  }

  public forceOpen(): void {
    this.nextAttempt = Date.now() + 60000;
    this.transitionTo('OPEN');
  }

  public forceClose(): void {
    this.failureCount = 0;
    this.consecutiveTrips = 0;
    this.transitionTo('CLOSED');
  }

  public getSnapshot() {
    return {
      name: this.name,
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      consecutiveTrips: this.consecutiveTrips,
      nextAttemptInMs: Math.max(0, this.nextAttempt - Date.now()),
    };
  }

  private transitionTo(nextState: CircuitBreakerState): void {
    if (this.state !== nextState) {
      const prev = this.state;
      this.state = nextState;
      if (nextState === 'HALF_OPEN') {
        this.halfOpenCalls = 0;
      }
      if (this.onStateChange) {
        this.onStateChange(this.name, prev, nextState);
      }
    }
  }

  public async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      if (fallback) {
        return fallback();
      }
      throw new Error(`CircuitBreaker[${this.name}] is OPEN. Requests shed to prevent cascading failure.`);
    }

    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      if (fallback) {
        return fallback();
      }
      throw err;
    }
  }
}
