export interface Country {
  code: string; name: string; region: string; lng: number; lat: number;
  capital: string[]; aliases?: string[]; capitalAliases?: string[];
  capitalQuestion?: string; notes?: string; [key: string]: unknown;
}
export interface WorldMap { features: Array<{code: string; path: string}> }
export interface LearningMapOptions {
  world?: WorldMap; countries?: Country[]; selectedCode?: string; labels?: boolean;
  allowSelect?: boolean; focusSelection?: boolean; onSelect?: (code: string) => void;
}
