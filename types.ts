
export interface Metadata {
  Title: string;
  Description: string;
  Tags: string;
  Type: string;
  Color: string;
}

export interface DesignData {
  id: string;
  metadata: Metadata;
  imageUrl: string;
  originalImageUrl: string;
  originalIdea: string;
  bgRemoved: boolean;
  upscaled: boolean;
}

export interface Message {
  text: string;
  isError: boolean;
}

export interface PrintReportItem {
    status: '✅' | '⚠️' | '❌' | string;
    details: string;
    suggestion?: string | null;
}

export interface PrintReport {
    resolution: PrintReportItem;
    color_safety: PrintReportItem;
    text_readability: PrintReportItem;
    transparency: PrintReportItem;
    edge_clarity: PrintReportItem;
}

export interface InspirationIdea {
    title: string;
    description: string;
    tags?: string[];
}

export interface InspirationAnalysis {
    theme: string;
    style: string;
    colors: string[];
    text: string;
    ideas: InspirationIdea[];
}

export interface AnalysisResult {
    printReport: PrintReport | null;
    inspiration: InspirationAnalysis | null;
    uploadedImage: string | null;
}
