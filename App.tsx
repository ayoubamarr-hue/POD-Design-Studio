import React, { useState, useCallback, useEffect } from 'react';
import { DesignData, Message, AnalysisResult, PrintReport } from './types';
import * as api from './services/apiService';
import ResultsGrid from './components/ResultsGrid';
import UploadAnalysis from './components/UploadAnalysis';

const App: React.FC = () => {
    const [ideaPrompt, setIdeaPrompt] = useState('');
    const [generatedDesigns, setGeneratedDesigns] = useState<DesignData[]>(() => {
        try {
            const savedDesigns = localStorage.getItem('podStudioDesigns');
            return savedDesigns ? JSON.parse(savedDesigns) : [];
        } catch (error) {
            console.error("Could not load designs from localStorage", error);
            return [];
        }
    });
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [message, setMessage] = useState<Message | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult>({ printReport: null, inspiration: null, uploadedImage: null });

    useEffect(() => {
        try {
            localStorage.setItem('podStudioDesigns', JSON.stringify(generatedDesigns));
        } catch (error) {
            console.error("Failed to save designs to localStorage", error);
            if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                showMessage("Could not save new designs. Your browser's local storage is full. Please download existing designs and clear the session to continue.", true);
            }
        }
    }, [generatedDesigns]);

    const showMessage = (text: string, isError: boolean = false) => {
        setMessage({ text, isError });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleSuggestIdea = async () => {
        setIsLoading(true);
        setLoadingMessage("Getting an idea from the AI...");
        try {
            const idea = await api.suggestIdea();
            if (idea) {
                setIdeaPrompt(prev => (prev ? prev + '\n' : '') + idea);
            } else {
                throw new Error("Received an empty idea.");
            }
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'An unknown error occurred.', true);
        } finally {
            setIsLoading(false);
        }
    };
    
    const generateSingleDesign = async (idea: string): Promise<DesignData | null> => {
        try {
            const { image_prompt, metadata } = await api.generateMetadataAndPrompt(idea);
            const imageUrl = await api.generateImageFromPrompt(image_prompt);
            return {
                id: crypto.randomUUID(),
                metadata,
                imageUrl,
                originalImageUrl: imageUrl,
                originalIdea: idea,
                bgRemoved: false,
                upscaled: false,
            };
        } catch (error) {
            console.error(`Error generating design for "${idea}":`, error);
            showMessage(`Failed to generate design for "${idea}". See console.`, true);
            return null;
        }
    };

    const handleBulkGeneration = async () => {
        const ideas = ideaPrompt.split('\n').map(idea => idea.trim()).filter(Boolean);
        if (ideas.length === 0) {
            showMessage("Please enter at least one design idea.", true);
            return;
        }

        setIsLoading(true);
        setMessage(null);
        setGeneratedDesigns([]);

        const newDesigns: DesignData[] = [];
        for (let i = 0; i < ideas.length; i++) {
            setLoadingMessage(`Generating design ${i + 1} of ${ideas.length}: "${ideas[i]}"`);
            const design = await generateSingleDesign(ideas[i]);
            if (design) {
                newDesigns.push(design);
                setGeneratedDesigns([...newDesigns]);
            }
        }
        setIsLoading(false);
    };

    const updateDesign = (id: string, updates: Partial<DesignData>) => {
        setGeneratedDesigns(designs => designs.map(d => d.id === id ? { ...d, ...updates } : d));
    };

    const blobToDataUrl = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleRemoveBackground = async (id: string) => {
        const design = generatedDesigns.find(d => d.id === id);
        if (!design || design.bgRemoved) return;
        
        try {
            const blob = await api.removeBackground(design.imageUrl);
            const newImageUrl = await blobToDataUrl(blob);
            updateDesign(id, { imageUrl: newImageUrl, bgRemoved: true });
            showMessage(`Background removed for design #${generatedDesigns.findIndex(d => d.id === id) + 1}!`);
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'BG removal failed.', true);
        }
    };

    const handleUpscale = async (id: string) => {
        const design = generatedDesigns.find(d => d.id === id);
        if (!design || design.upscaled) return;

        try {
            const blob = await api.upscaleImage(design.imageUrl);
            const newImageUrl = await blobToDataUrl(blob);
            updateDesign(id, { imageUrl: newImageUrl, upscaled: true });
            showMessage(`Design #${generatedDesigns.findIndex(d => d.id === id) + 1} upscaled!`);
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Upscaling failed.', true);
        }
    };

    const handleRemix = async (id: string) => {
        const design = generatedDesigns.find(d => d.id === id);
        if (!design) return;
        showMessage(`Remixing design: "${design.originalIdea}"...`);
        const newDesign = await generateSingleDesign(design.originalIdea);
        if (newDesign) {
            setGeneratedDesigns(prev => [...prev, newDesign]);
            showMessage(`Remix successful! New design added.`);
        }
    };

    const handleRevert = (id: string) => {
        const design = generatedDesigns.find(d => d.id === id);
        if (!design || design.imageUrl === design.originalImageUrl) return;
        updateDesign(id, {
            imageUrl: design.originalImageUrl,
            bgRemoved: false,
            upscaled: false
        });
        showMessage(`Design #${generatedDesigns.findIndex(d => d.id === id) + 1} reverted.`);
    };
    
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    const handleImageUpload = async (file: File) => {
        setIsAnalyzing(true);
        setAnalysisResult({ printReport: null, inspiration: null, uploadedImage: null });
        setMessage(null);
        
        try {
            const base64String = await blobToBase64(file);
            const mimeType = file.type;
            const imageUrl = URL.createObjectURL(file);

            const image = new Image();
            image.src = imageUrl;
            await new Promise(resolve => (image.onload = resolve));
            const { naturalWidth, naturalHeight } = image;

            const [inspirationResponse, printResponse] = await Promise.all([
                api.analyzeImageForInspiration(base64String, mimeType),
                api.analyzeImageForPrint(base64String, mimeType, naturalWidth, naturalHeight)
            ]);

            const dpi = Math.round(Math.max(naturalWidth, naturalHeight) / 15);
            const finalReport: PrintReport = {
                resolution: {
                    status: (naturalWidth >= 4500 && naturalHeight >= 5400) ? '✅' : '⚠️',
                    details: `Your image is ${naturalWidth}x${naturalHeight}px (~${dpi} DPI). Recommended: 4500x5400px (300 DPI).`,
                    suggestion: (naturalWidth < 4500 || naturalHeight < 5400) ? "Use an upscaler for a high-quality print." : null
                },
                ...printResponse
            };

            setAnalysisResult({ printReport: finalReport, inspiration: inspirationResponse, uploadedImage: imageUrl });

        } catch (error) {
            showMessage(error instanceof Error ? error.message : "Analysis failed.", true);
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    const handleGenerateFromIdea = async (description: string) => {
        setIsLoading(true);
        setLoadingMessage(`Generating: "${description}"`);
        const newDesign = await generateSingleDesign(description);
        if (newDesign) {
            setGeneratedDesigns(prev => [...prev, newDesign]);
            showMessage('New design generated from suggestion!');
        }
        setIsLoading(false);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const handleNicheResearch = async () => {
        setIsLoading(true);
        setLoadingMessage("Researching a high-potential niche...");
        try {
            const briefText = await api.getNicheResearch();
            setModalContent(briefText);
            setIsModalOpen(true);
        } catch (error) {
            showMessage(error instanceof Error ? error.message : "Failed to get niche research.", true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearSession = () => {
        if (window.confirm('Are you sure you want to clear all generated designs? This action cannot be undone.')) {
            setGeneratedDesigns([]);
            showMessage('Session cleared successfully.');
        }
    };
    
    const NicheResearchModal = () => {
        if (!isModalOpen) return null;
        let htmlContent = modalContent
            .replace(/## (.*?)\n/g, '<h3 class="text-xl font-bold mt-4 mb-2 text-indigo-300">$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\* (.*?)\n/g, '<li class="ml-5 list-disc">$1</li>')
            .replace(/\n/g, '<br />');

        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50" onClick={() => setIsModalOpen(false)}>
                <div className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                        <h2 className="text-2xl font-bold">Niche Research Brief</h2>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white text-3xl">&times;</button>
                    </div>
                    <div className="p-6 text-gray-300 overflow-y-auto" dangerouslySetInnerHTML={{ __html: htmlContent }} />
                </div>
            </div>
        );
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4">
            <div className="container mx-auto p-4 max-w-5xl">
                <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-10">

                    <header className="text-center mb-8">
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-100">POD Design Studio</h1>
                        <p className="text-gray-400 mt-2">Generate, upscale, and prepare print-ready designs for TeePublic.</p>
                    </header>

                    <div className="mb-6">
                        <label htmlFor="idea-prompt" className="block text-sm font-medium text-gray-300 mb-2">Enter your design ideas (one per line):</label>
                        <div className="flex flex-col gap-4">
                            <textarea id="idea-prompt" className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" rows={5} placeholder="A vintage synthwave cat...&#10;A retro floral design...&#10;A minimalist geometric mountain range..." value={ideaPrompt} onChange={e => setIdeaPrompt(e.target.value)} disabled={isLoading}></textarea>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button onClick={handleNicheResearch} className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50" disabled={isLoading}>✨ Niche Research</button>
                                <button onClick={handleSuggestIdea} className="w-full sm:w-auto bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50" disabled={isLoading}>Inspire Me</button>
                                <button onClick={handleBulkGeneration} className="w-full sm:flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50" disabled={isLoading}>Generate Bulk Designs</button>
                            </div>
                        </div>
                    </div>
                    
                    <UploadAnalysis onImageUpload={handleImageUpload} analysisResult={analysisResult} isAnalyzing={isAnalyzing} onGenerateFromIdea={handleGenerateFromIdea}/>
                    
                    {isLoading && (
                        <div className="text-center p-8">
                            <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-500 h-12 w-12 mx-auto mb-4"></div>
                            <p className="text-gray-400">{loadingMessage}</p>
                        </div>
                    )}
                    
                    {!isLoading && <ResultsGrid designs={generatedDesigns} onRemoveBackground={handleRemoveBackground} onUpscale={handleUpscale} onRemix={handleRemix} onRevert={handleRevert} onDownloadAll={() => api.downloadAllImagesAsZip(generatedDesigns)} onDownloadMetadata={() => api.downloadMetadataAsXLSX(generatedDesigns)} onClearSession={handleClearSession} />}
                </div>
                {message && (
                    <div className={`mt-4 px-4 py-3 rounded-lg relative fade-in ${message.isError ? 'bg-red-800/50 border border-red-600 text-red-300' : 'bg-blue-800/50 border border-blue-600 text-blue-300'}`} role="alert">
                        <span className="block sm:inline">{message.text}</span>
                    </div>
                )}
            </div>
            <NicheResearchModal />
        </div>
    );
};

export default App;