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
    for (const callback of Array.from(subscribers)) {
      try {
        callback();
      } catch (error) {
        console.error('Registry subscriber callback threw an error:', error);
      }
    }
  }

  return {
    add(feature: Feature): void {
      features.set(feature.id, structuredClone(feature));
      notify();
    },

    update(id: string, partial: Partial<Omit<Feature, 'id'>>): void {
      const existing = features.get(id);
      if (existing) {
        const updated: Feature = { ...existing };

        // Shallow-merge known nested objects so partial updates don't drop sibling fields.
        if (partial.style !== undefined) {
          updated.style = { ...existing.style, ...partial.style };
        }
        if (partial.metadata !== undefined) {
          updated.metadata = { ...existing.metadata, ...partial.metadata };
        }

        // Apply remaining defined fields, skipping undefined values and
        // keys already handled above.
        for (const [key, value] of Object.entries(partial)) {
          if (value === undefined) continue;
          if (key === 'id' || key === 'style' || key === 'metadata') continue;
          (updated as Record<string, unknown>)[key] = value;
        }

        features.set(id, structuredClone(updated));
        notify();
      }
    },

    remove(id: string): void {
      if (features.delete(id)) {
        notify();
      }
    },

    get(id: string): Feature | undefined {
      const feature = features.get(id);
      return feature ? structuredClone(feature) : undefined;
    },

    getAll(): Feature[] {
      return Array.from(features.values()).map((f) => structuredClone(f));
    },

    getByType(type: FeatureType): Feature[] {
      return Array.from(features.values())
        .filter((f) => f.type === type)
        .map((f) => structuredClone(f));
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
