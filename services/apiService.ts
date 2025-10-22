import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Metadata, InspirationAnalysis, PrintReport } from '../types';

// Declarations for libraries loaded via CDN
declare var XLSX: any;
declare var JSZip: any;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// --- Gemini API Calls ---

export async function suggestIdea(): Promise<string> {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: "Generate a single, creative, and concise t-shirt design idea. For example: 'A cheerful cartoon avocado meditating'. Just provide the idea, nothing else." }] }],
    });
    return response.text.trim().replace(/"/g, '');
}

export async function generateMetadataAndPrompt(userIdea: string): Promise<{ image_prompt: string; metadata: Metadata }> {
    const systemPrompt = `You are a professional TeePublic trend analyst and creative director. Your mission is to take a user's idea and evolve it into a concept optimized for sales on TeePublic, focusing on today's most searched and best-selling niches.

**Current TeePublic Trends to Consider:**
* **Retro & Nostalgia:** 80s synthwave, 90s aesthetics, vintage movie posters, old-school video games.
* **Pop Culture Mashups:** Cleverly combining elements from popular TV shows, movies, and anime.
* **Minimalist & Aesthetic:** Clean line art, simple geometric shapes, elegant typography.
* **Cottagecore & Dark Academia:** Botanical illustrations, mushrooms, frogs, skulls, vintage books.
* **Humor & Sarcasm:** Funny text-based designs, relatable memes, witty commentary.

Based on the user's idea, you will produce:
1.  **image_prompt**: A highly detailed and descriptive prompt for an AI image generator. It must specify the artistic style (e.g., "vintage comic book style," "clean vector art," "distressed screenprint look"), subject matter, composition, and color palette. **CRITICAL:** The design must be generated on a solid, simple, single-color background (like 'on a plain white background') to ensure easy background removal.
2.  **metadata**: A JSON object with {Title, Description, Tags, Type, Color}, fully optimized for TeePublic's SEO. The 'Tags' must be a rich, comma-separated string of at least 10-15 relevant keywords that a customer would search for.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: `User Idea: "${userIdea}"` }] }],
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    "image_prompt": { type: Type.STRING },
                    "metadata": {
                        type: Type.OBJECT,
                        properties: {
                            "Title": { type: Type.STRING },
                            "Description": { type: Type.STRING },
                            "Tags": { type: Type.STRING },
                            "Type": { type: Type.STRING },
                            "Color": { type: Type.STRING }
                        }
                    }
                }
            }
        }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Invalid response from metadata AI.");
    return JSON.parse(jsonText);
}

export async function generateImageFromPrompt(prompt: string): Promise<string> {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            aspectRatio: "3:4"
        }
    });

    const base64ImageData = response.generatedImages[0]?.image?.imageBytes;
    if (!base64ImageData) throw new Error("Could not find image data in response.");
    return `data:image/png;base64,${base64ImageData}`;
}

export async function analyzeImageForInspiration(base64ImageData: string, mimeType: string): Promise<InspirationAnalysis> {
    const systemPrompt = "You are a creative director for a Print-on-Demand t-shirt company. Analyze the user's uploaded t-shirt design. Your task is to identify its core elements and generate 3-5 new, unique, and marketable design ideas inspired by it. You MUST return a JSON object with the specified schema.";
    const userQuery = "Analyze this t-shirt design. Identify the theme, style, dominant colors, and any text. Based on this analysis, generate 3 to 5 new t-shirt design ideas. For each new idea, provide a short title, a one-line visual description suitable for an AI image generator, and a few relevant style tags.";
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: userQuery }, { inlineData: { mimeType, data: base64ImageData } }] },
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            // FIX: Corrected the responseSchema to have a valid TypeScript object literal structure.
            // Removed extra quotes and ensured schema keywords like 'type', 'properties', 'items' are unquoted.
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    "theme": { type: Type.STRING },
                    "style": { type: Type.STRING },
                    "colors": {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    },
                    "text": { type: Type.STRING },
                    "ideas": {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                "title": { type: Type.STRING },
                                "description": { type: Type.STRING },
                                "tags": {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                }
                            },
                            required: ["title", "description"]
                        }
                    }
                }
            }
        }
    });
    
    const jsonText = response.text;
    if (!jsonText) throw new Error("Invalid inspiration response from AI.");
    return JSON.parse(jsonText);
}

export async function analyzeImageForPrint(base64ImageData: string, mimeType: string, width: number, height: number): Promise<Omit<PrintReport, 'resolution'>> {
    const systemPrompt = `You are a Print-on-Demand (POD) technical expert. Your role is to analyze an uploaded design and determine its print-readiness. You will check for specific technical issues that affect print quality.
    - **Color Safety**: Identify if the image uses colors (like bright neons) that are outside the typical CMYK printing gamut. Suggest a safer, printable CMYK alternative for each problematic color.
    - **Text Readability**: Check for text that is too small, blurry, or has low contrast against its background, which would make it unreadable when printed on a shirt.
    - **Edge Clarity**: Examine the design's edges for blurriness, pixelation, or excessive softness that would result in a poor-quality print. Suggest sharpening if needed.
    - **Transparency**: Assess if the image has a clean, transparent background or if there are unwanted artifacts/semi-transparent pixels left over.
    
    You MUST return a JSON object with the specified schema, providing a status ('✅', '⚠️', '❌') and a brief, actionable 'details' string for each category.`;
    const userQuery = `Analyze the attached image for print-readiness. The image resolution is ${width}x${height}px. Based on your visual analysis, evaluate color safety, text readability, transparency, and edge clarity.`;
     
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: userQuery }, { inlineData: { mimeType, data: base64ImageData } }] },
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            // FIX: Corrected the responseSchema to have a valid TypeScript object literal structure.
            // This fixes issues where schema keywords were incorrectly quoted as strings.
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    "color_safety": {
                        type: Type.OBJECT,
                        properties: {
                            "status": { type: Type.STRING },
                            "details": { type: Type.STRING },
                            "suggestion": { type: Type.STRING }
                        }
                    },
                    "text_readability": {
                        type: Type.OBJECT,
                        properties: {
                            "status": { type: Type.STRING },
                            "details": { type: Type.STRING }
                        }
                    },
                    "transparency": {
                        type: Type.OBJECT,
                        properties: {
                            "status": { type: Type.STRING },
                            "details": { type: Type.STRING }
                        }
                    },
                    "edge_clarity": {
                        type: Type.OBJECT,
                        properties: {
                            "status": { type: Type.STRING },
                            "details": { type: Type.STRING },
                            "suggestion": { type: Type.STRING }
                        }
                    }
                }
            }
        }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Invalid print-readiness response from AI.");
    return JSON.parse(jsonText);
}

export async function getNicheResearch(): Promise<string> {
    const systemPrompt = `You are a professional TeePublic trend analyst and creative director. Your mission is to generate a complete, marketable t-shirt design concept based on a single, high-potential niche that you identify. The output MUST follow this markdown structure EXACTLY:

## 1. Core Concept & Niche
A paragraph explaining the core idea and the target niche.
**Keywords:** A list of comma-separated keywords.

## 2. Visual Style & Composition
A detailed description of the visual style, focal point, and background elements.

## 3. Color Palette
A list of primary and accent colors, and recommended t-shirt colors.

## 4. Target Audience & Marketability
An analysis of the target audience and why the design is marketable.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts: [{ text: "Generate a new, complete t-shirt design concept brief for a trending niche." }] }],
        config: {
             systemInstruction: systemPrompt
        }
    });
    
    return response.text;
}

// --- Image Editing API Calls ---

export async function removeBackground(imageUrl: string): Promise<Blob> {
    const apiKey = 'f5b40dda9489f6fa85eb2e7e103e9bab84d0d765226b6f8ef264bb98bfddc5eabfefa52ad4005191d1bd590f7032fc94';

    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();

    const formData = new FormData();
    formData.append('image_file', imageBlob, 'image.png');

    const response = await fetch('https://clipdrop-api.co/remove-background/v1', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
        },
        body: formData,
    });

    if (!response.ok) {
        try {
            const errorData = await response.json();
            throw new Error(`Clipdrop API Error: ${errorData.error || response.statusText}`);
        } catch (e) {
            throw new Error(`Clipdrop API Error: ${response.status} ${response.statusText}`);
        }
    }
    return response.blob();
}


export async function upscaleImage(imageUrl: string): Promise<Blob> {
    const parts = imageUrl.split(',');
    const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const base64Data = parts[1];

    if (!base64Data) {
        throw new Error("Invalid image URL for upscaling.");
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: 'Upscale this image, doubling its resolution. Enhance details, sharpen edges, and improve overall clarity without adding, removing, or changing any elements in the original composition. The output must be a high-quality, upscaled version of the provided image.',
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        const newImageUrl = `data:image/png;base64,${base64ImageBytes}`;
        const fetchResponse = await fetch(newImageUrl);
        return fetchResponse.blob();
      }
    }
    
    throw new Error("AI could not process the image for upscaling.");
}


// --- File Handling ---

export function downloadMetadataAsXLSX(designs: { metadata: Metadata }[]): void {
    const data = designs.map((item, index) => {
        const metadata = item.metadata;
        const title = metadata.Title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || `design_${index}`;
        const imagePath = `C:\\Downloads\\${title}.png`;
        return {
            "Image Path": imagePath,
            "Language": "EN",
            "Title": metadata.Title,
            "Description": metadata.Description,
            "Tags": metadata.Tags,
            "Type": metadata.Type,
            "Color": metadata.Color
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "FlyingUploadData");
    XLSX.writeFile(workbook, "FlyingUploadData.xlsx");
}

export async function downloadAllImagesAsZip(designs: { imageUrl: string, metadata: Metadata }[]): Promise<void> {
    const zip = new JSZip();
    for (let i = 0; i < designs.length; i++) {
        const design = designs[i];
        const response = await fetch(design.imageUrl);
        const blob = await response.blob();
        const title = design.metadata.Title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || `design_${i}`;
        zip.file(`${title}.png`, blob);
    }

    const content = await zip.generateAsync({ type: "blob" });
    
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "POD_Designs.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}