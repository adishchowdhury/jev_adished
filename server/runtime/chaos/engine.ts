/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChaosSettings {
  simulateLatencyMs: number;
  simulateFailure: boolean;
  slowClientMs: number;
  tripGeminiCircuit: boolean;
  active: boolean;
}

export class ChaosEngine {
  private settings: ChaosSettings = {
    simulateLatencyMs: 0,
    simulateFailure: false,
    slowClientMs: 0,
    tripGeminiCircuit: false,
    active: false,
  };

  public getSettings(): ChaosSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<ChaosSettings>): ChaosSettings {
    this.settings = {
      ...this.settings,
      ...partial,
      active: (partial.simulateLatencyMs ?? this.settings.simulateLatencyMs) > 0 ||
              (partial.simulateFailure ?? this.settings.simulateFailure) ||
              (partial.slowClientMs ?? this.settings.slowClientMs) > 0 ||
              (partial.tripGeminiCircuit ?? this.settings.tripGeminiCircuit),
    };
    return this.getSettings();
  }

  public reset(): void {
    this.settings = {
      simulateLatencyMs: 0,
      simulateFailure: false,
      slowClientMs: 0,
      tripGeminiCircuit: false,
      active: false,
    };
  }
}

export const globalChaosEngine = new ChaosEngine();
