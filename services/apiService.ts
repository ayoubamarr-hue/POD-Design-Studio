import { Metadata, InspirationAnalysis, PrintReport, DesignData } from '../types';

declare var XLSX: any;
declare var JSZip: any;

async function handleApiResponse(response: Response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown server error occurred' }));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }
    return response.json();
}

async function base64ToBlob(base64: string, mimeType: string = 'image/png'): Promise<Blob> {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
}

const imageUrlToBase64 = async (url: string): Promise<{ base64: string, mimeType: string }> => {
    const response = await fetch(url);
    const blob = await response.blob();
    const mimeType = blob.type;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64string = (reader.result as string).split(',')[1];
            resolve({ base64: base64string, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// --- Proxied API Calls ---

export async function suggestIdea(): Promise<string> {
    const response = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggestIdea' }),
    });
    const data = await handleApiResponse(response);
    return data.text;
}

export async function generateMetadataAndPrompt(userIdea: string): Promise<{ image_prompt: string; metadata: Metadata }> {
    const response = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generateMetadataAndPrompt', payload: { userIdea } }),
    });
    return handleApiResponse(response);
}

export async function generateImageFromPrompt(prompt: string): Promise<string> {
    const response = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generateImageFromPrompt', payload: { prompt } }),
    });
    const data = await handleApiResponse(response);
    return `data:image/png;base64,${data.imageBase64}`;
}

export async function analyzeImageForInspiration(base64ImageData: string, mimeType: string): Promise<InspirationAnalysis> {
    const response = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyzeImageForInspiration', payload: { base64ImageData, mimeType } }),
    });
    return handleApiResponse(response);
}

export async function analyzeImageForPrint(base64ImageData: string, mimeType: string, width: number, height: number): Promise<PrintReport> {
    const response = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyzeImageForPrint', payload: { base64ImageData, mimeType, width, height } }),
    });
    return handleApiResponse(response);
}

export async function getNicheResearch(): Promise<string> {
    const response = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getNicheResearch' }),
    });
    const data = await handleApiResponse(response);
    return data.text;
}

export async function removeBackground(imageUrl: string): Promise<Blob> {
    const response = await fetch('/api/clipdrop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { imageUrl } }),
    });
    const data = await handleApiResponse(response);
    return base64ToBlob(data.imageBase64);
}

export async function upscaleImage(imageUrl: string): Promise<Blob> {
    const { base64, mimeType } = await imageUrlToBase64(imageUrl);
    const response = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upscaleImage', payload: { base64ImageData: base64, mimeType } }),
    });
    const data = await handleApiResponse(response);
    return base64ToBlob(data.imageBase64);
}


// --- Client-Side Only Functions ---

export async function downloadAllImagesAsZip(designs: DesignData[]): Promise<void> {
    const zip = new JSZip();
    const promises = designs.map(async (design, index) => {
        const response = await fetch(design.imageUrl);
        const blob = await response.blob();
        const title = design.metadata.Title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || `design_${index + 1}`;
        zip.file(`${title}.png`, blob);
    });
    await Promise.all(promises);
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = 'pod_studio_designs.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export function downloadMetadataAsXLSX(designs: DesignData[]): void {
    const worksheetData = designs.map(d => ({
        Title: d.metadata.Title,
        Description: d.metadata.Description,
        Tags: d.metadata.Tags,
        Type: d.metadata.Type,
        Color: d.metadata.Color,
        OriginalIdea: d.originalIdea,
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Designs');
    XLSX.writeFile(workbook, 'metadata.xlsx');
}