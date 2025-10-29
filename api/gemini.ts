
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { Metadata, InspirationAnalysis, PrintReport } from '../types';

const handleError = (res: VercelResponse, error: unknown, context: string) => {
    console.error(`Error in ${context}:`, error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred.';
    res.status(500).json({ error: message });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // FIX: Use process.env.API_KEY as per the guidelines.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured on the server. Please set the API_KEY environment variable.' });
    }
    const ai = new GoogleGenAI({ apiKey });

    const { action, payload } = req.body;

    try {
        switch (action) {
            case 'suggestIdea': {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [{ parts: [{ text: "Generate a single, creative, and concise t-shirt design idea. For example: 'A cheerful cartoon avocado meditating'. Just provide the idea, nothing else." }] }],
                });
                return res.status(200).json({ text: response.text.trim().replace(/"/g, '') });
            }

            case 'generateMetadataAndPrompt': {
                const { userIdea } = payload;
                if (!userIdea) return res.status(400).json({ error: 'userIdea is required.' });
                
                const systemPrompt = `You are a professional TeePublic trend analyst and creative director. Your goal is to take a user's rough idea and transform it into a complete, ready-to-use package for a print-on-demand design. This includes creating a compelling image prompt for an AI image generator and writing optimized metadata (Title, Description, Tags). The metadata should be catchy, relevant, and optimized for search on platforms like TeePublic. Provide a single, specific "Type" (e.g., "T-Shirt", "Sticker", "Mug") and a suggested "Color" for the product that would best suit the design. The image prompt should be detailed, evocative, and styled for modern t-shirt aesthetics (e.g., 'vector art, clean lines, vintage texture, isolated on a transparent background').`;
                
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
                                    properties: { "Title": { type: Type.STRING }, "Description": { type: Type.STRING }, "Tags": { type: Type.STRING }, "Type": { type: Type.STRING }, "Color": { type: Type.STRING } },
                                    // FIX: Add required fields for robustness
                                    required: ["Title", "Description", "Tags", "Type", "Color"]
                                }
                            },
                             // FIX: Add required fields for robustness
                            required: ["image_prompt", "metadata"]
                        }
                    }
                });
                return res.status(200).json(JSON.parse(response.text));
            }

            case 'generateImageFromPrompt': {
                const { prompt } = payload;
                if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });
                
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: {
                        parts: [{ text: prompt }],
                    },
                    config: {
                        responseModalities: [Modality.IMAGE],
                    },
                });

                const resultPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (!resultPart?.inlineData?.data) {
                    throw new Error("Could not find image data in Gemini response.");
                }
                
                return res.status(200).json({ imageBase64: resultPart.inlineData.data });
            }

            // FIX: Implemented missing generateContent call for image analysis.
            case 'analyzeImageForInspiration': {
                const { base64ImageData, mimeType } = payload;
                if (!base64ImageData) return res.status(400).json({ error: 'Image data is required.' });

                const systemPrompt = "You are a creative director and design trend analyst for a print-on-demand service like TeePublic. Your goal is to analyze user-submitted designs to provide them with creative inspiration and actionable ideas for new designs.";
                const userQuery = "Analyze this t-shirt design. Identify its core theme, artistic style, primary color palette, and any text present. Based on this analysis, generate 3 distinct, new t-shirt design ideas that logically extend or creatively remix the original concept. For each new idea, provide a title, a brief description for a designer, and a few relevant tags.";

                const imagePart = { inlineData: { data: base64ImageData, mimeType: mimeType || 'image/png' } };
                const textPart = { text: userQuery };

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [imagePart, textPart] },
                    config: {
                        systemInstruction: systemPrompt,
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                theme: { type: Type.STRING, description: "The core theme of the design." },
                                style: { type: Type.STRING, description: "The artistic style of the design." },
                                colors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of dominant colors as hex codes." },
                                text: { type: Type.STRING, description: "Any text detected in the image. Null if none." },
                                ideas: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            title: { type: Type.STRING },
                                            description: { type: Type.STRING },
                                            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                                        },
                                        required: ["title", "description"]
                                    },
                                    description: "An array of 3 new, creative design ideas."
                                }
                            },
                            required: ["theme", "style", "colors", "ideas"]
                        }
                    }
                });
                return res.status(200).json(JSON.parse(response.text));
            }

            // FIX: Implemented missing generateContent call for print readiness analysis.
            case 'analyzeImageForPrint': {
                const { base64ImageData, mimeType, width, height } = payload;
                if (!base64ImageData) return res.status(400).json({ error: 'Image data is required.' });

                const systemPrompt = "You are a quality assurance specialist for a Print-on-Demand service. Your task is to analyze images for technical print-readiness for t-shirts. Your analysis must be objective and based on common printing issues. The user already knows the image resolution; do not comment on it.";
                const userQuery = `Analyze the provided image (${width}x${height}px) for print-readiness, focusing ONLY on the following aspects: Color Safety (check for out-of-gamut colors for CMYK printing, like overly bright neons), Text Readability (ensure text is clear and large enough), Transparency (check if the image has a clean, transparent background or if it's a solid box that might look bad on a colored shirt), and Edge Clarity (check for blurry or pixelated edges). Provide a status ('✅', '⚠️', '❌'), a details string, and an optional suggestion for each aspect.`;

                const imagePart = { inlineData: { data: base64ImageData, mimeType: mimeType || 'image/png' } };
                const textPart = { text: userQuery };

                const printReportItemSchema = {
                    type: Type.OBJECT,
                    properties: {
                        status: { type: Type.STRING, description: "One of: '✅', '⚠️', '❌'" },
                        details: { type: Type.STRING, description: "A concise explanation of the finding." },
                        suggestion: { type: Type.STRING, description: "An optional suggestion for improvement." }
                    },
                    required: ['status', 'details']
                };

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [imagePart, textPart] },
                    config: {
                        systemInstruction: systemPrompt,
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                color_safety: printReportItemSchema,
                                text_readability: printReportItemSchema,
                                transparency: printReportItemSchema,
                                edge_clarity: printReportItemSchema,
                            },
                            required: ['color_safety', 'text_readability', 'transparency', 'edge_clarity']
                        }
                    }
                });
                return res.status(200).json(JSON.parse(response.text));
            }

            // FIX: Implemented missing generateContent call for niche research.
            case 'getNicheResearch': {
                const prompt = "Act as a TeePublic and Etsy trend analyst. Identify a single, currently trending but not overly saturated niche for t-shirt designs. Provide a brief analysis. Format the output as clean markdown with the following main headings: `## Niche`, `## Audience`, `## Styles`, and `## Ideas`. Under `## Ideas`, provide 3 specific, actionable design ideas as a bulleted list using `* `. Use double asterisks for bolding key terms.";
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [{ parts: [{ text: prompt }] }],
                });
                return res.status(200).json({ text: response.text });
            }

            case 'upscaleImage': {
                const { base64ImageData, mimeType } = payload;
                if (!base64ImageData) return res.status(400).json({ error: 'Image data is required.' });

                const imagePart = { inlineData: { data: base64ImageData, mimeType: mimeType || 'image/png' } };
                const textPart = { text: 'Upscale this image to a high resolution suitable for a large print (e.g., 4500x5400 pixels), enhancing details and clarity without adding new elements. Ensure the background remains transparent if it is already.' };
                
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [imagePart, textPart] },
                    config: { responseModalities: [Modality.IMAGE] }
                });

                const resultPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (!resultPart?.inlineData?.data) throw new Error('Could not find upscaled image data in response.');

                return res.status(200).json({ imageBase64: resultPart.inlineData.data });
            }

            default:
                return res.status(400).json({ error: 'Invalid action specified.' });
        }
    } catch (error) {
        handleError(res, error, `Gemini action: ${action}`);
    }
}
