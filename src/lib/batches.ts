export const LAB_BATCHES = ["B1", "B2", "B3", "B4", "B5"] as const;
export type LabBatch = (typeof LAB_BATCHES)[number];

export const DIVISIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"] as const;
export type Division = (typeof DIVISIONS)[number];
