export type FeatureType = 'land' | 'water' | 'border' | 'river';

export interface Point {
  x: number;
  y: number;
}

export interface FeatureStyle {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}

export interface Feature {
  id: string;
  type: FeatureType;
  geometry: Point[];
  closed: boolean;
  style: FeatureStyle;
  metadata?: Record<string, unknown>;
}
