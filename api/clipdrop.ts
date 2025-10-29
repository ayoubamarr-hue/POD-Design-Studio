import type { VercelRequest, VercelResponse } from '@vercel/node';
import FormData from 'form-data';
// FIX: Import `Buffer` from the 'buffer' module to resolve the 'Cannot find name `Buffer`' TypeScript error.
import { Buffer } from 'buffer';

const dataUrlToBuffer = (dataUrl: string) => {
    const base64 = dataUrl.split(',')[1];
    if (!base64) throw new Error('Invalid data URL');
    return Buffer.from(base64, 'base64');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { imageUrl } = req.body.payload;
    const clipdropApiKey = process.env.CLIPDROP_API_KEY;

    if (!clipdropApiKey) {
        return res.status(500).json({ error: 'Clipdrop API key not configured on the server.' });
    }
    if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required' });
    }

    try {
        const imageBuffer = dataUrlToBuffer(imageUrl);
        const formData = new FormData();
        formData.append('image_file', imageBuffer, { filename: 'image.png' });

        const clipdropResponse = await fetch('https://clipdrop-api.co/remove-background/v1', {
            method: 'POST',
            headers: {
                'x-api-key': clipdropApiKey,
                ...formData.getHeaders(),
            },
            // FIX: Cast `formData` to `any` to resolve a type mismatch.
            // The `form-data` object is a stream-like object that `fetch` in Node.js can handle,
            // but its type is not directly compatible with the `BodyInit` type expected by TypeScript.
            body: formData as any,
        });

        if (!clipdropResponse.ok) {
            const errorBody = await clipdropResponse.json().catch(() => ({error: 'Unknown Clipdrop API error'}));
            console.error('Clipdrop API Error:', errorBody);
            return res.status(clipdropResponse.status).json({ error: errorBody.error || 'Failed to remove background.' });
        }

        const resultBuffer = await clipdropResponse.arrayBuffer();
        const base64Image = Buffer.from(resultBuffer).toString('base64');
        res.status(200).json({ imageBase64: base64Image });

    } catch (error) {
        console.error('Error in clipdrop handler:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'An internal server error occurred.' });
    }
}