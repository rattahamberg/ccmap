import type { Feature, FeatureType } from './types';

export interface Registry {
  add(feature: Feature): void;
  update(id: string, partial: Partial<Omit<Feature, 'id'>>): void;
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
      try {
        callback();
      } catch (error) {
        console.error('Registry subscriber callback threw an error:', error);
      }
    }
  }

  return {
    add(feature: Feature): void {
      features.set(feature.id, feature);
      notify();
    },

    update(id: string, partial: Partial<Omit<Feature, 'id'>>): void {
      const existing = features.get(id);
      if (existing) {
        const updated: Feature = { ...existing, ...partial };

        // Deep-merge known nested objects so partial updates don't drop fields.
        if (partial.style) {
          updated.style = { ...existing.style, ...partial.style };
        }
        if (partial.metadata) {
          updated.metadata = { ...existing.metadata, ...partial.metadata };
        }

        features.set(id, updated);
        notify();
      }
    },

    remove(id: string): void {
      if (features.delete(id)) {
        notify();
      }
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
      if (features.size === 0) {
        return;
      }
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
