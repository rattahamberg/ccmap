import type { Feature, FeatureType } from './types';

export interface Registry {
  add(feature: Feature): void;
  update(id: string, partial: Partial<Feature>): void;
  remove(id: string): void;
  get(id: string): Feature | undefined;
  getAll(): Feature[];
  getByType(type: FeatureType): Feature[];
  clear(): void;
  subscribe(callback: () => void): () => void;
}

export function createRegistry(): Registry {
  const features = new Map<string, Feature>();
  const subscribers = new Set<() => void>();

  function notify(): void {
    for (const callback of subscribers) {
      callback();
    }
  }

  return {
    add(feature: Feature): void {
      features.set(feature.id, feature);
      notify();
    },

    update(id: string, partial: Partial<Feature>): void {
      const existing = features.get(id);
      if (existing) {
        features.set(id, { ...existing, ...partial, id });
        notify();
      }
    },

    remove(id: string): void {
      features.delete(id);
      notify();
    },

    get(id: string): Feature | undefined {
      return features.get(id);
    },

    getAll(): Feature[] {
      return Array.from(features.values());
    },

    getByType(type: FeatureType): Feature[] {
      return Array.from(features.values()).filter((f) => f.type === type);
    },

    clear(): void {
      features.clear();
      notify();
    },

    subscribe(callback: () => void): () => void {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
  };
}
