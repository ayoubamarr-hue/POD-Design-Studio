import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DesignData } from '../types';

interface ImageEditorProps {
    design: DesignData;
    onSave: (newImageUrl: string) => void;
    onClose: () => void;
}

const FONT_OPTIONS = ['Impact', 'Arial', 'Helvetica', 'Georgia', 'Courier New', 'Verdana'];

const ImageEditor: React.FC<ImageEditorProps> = ({ design, onSave, onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [text, setText] = useState({ content: 'Your Text', size: 48, color: '#FFFFFF', font: 'Impact', x: 50, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [cursor, setCursor] = useState('default');

    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const img = imageRef.current;
        if (!canvas || !ctx || !img) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        ctx.font = `${text.size}px ${text.font}`;
        ctx.fillStyle = text.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text.content, text.x, text.y);

    }, [text]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = design.imageUrl;
        img.onload = () => {
            imageRef.current = img;
            canvas.width = img.width;
            canvas.height = img.height;
            setText(prev => ({ ...prev, x: canvas.width / 2 - 100, y: canvas.height * 0.8 }));
            redrawCanvas();
        };
        img.onerror = () => console.error("Failed to load image for canvas.");
    }, [design.imageUrl, redrawCanvas]);

    useEffect(() => {
        redrawCanvas();
    }, [text, redrawCanvas]);
    
    const isOverText = (mouseX: number, mouseY: number): boolean => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return false;

        ctx.font = `${text.size}px ${text.font}`;
        const metrics = ctx.measureText(text.content);
        const textWidth = metrics.width;
        const textHeight = text.size; 

        return mouseX >= text.x && mouseX <= text.x + textWidth &&
               mouseY >= text.y && mouseY <= text.y + textHeight;
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        if (isOverText(mouseX, mouseY)) {
            setIsDragging(true);
            setDragStart({ x: mouseX - text.x, y: mouseY - text.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        if (isDragging) {
            setText(prev => ({ ...prev, x: mouseX - dragStart.x, y: mouseY - dragStart.y }));
        } else {
            setCursor(isOverText(mouseX, mouseY) ? 'move' : 'default');
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            onSave(canvas.toDataURL('image/png'));
        }
    };
    
    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setText(prev => ({ ...prev, content: e.target.value }));
    };

    const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setText(prev => ({ ...prev, size: Number(e.target.value) }));
    };
    
    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setText(prev => ({ ...prev, color: e.target.value }));
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 fade-in">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col md:flex-row overflow-hidden">
                <div className="flex-grow bg-gray-900 flex items-center justify-center p-4 overflow-auto">
                    <canvas
                        ref={canvasRef}
                        className="max-w-full max-h-full object-contain"
                        style={{ cursor: cursor }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />
                </div>
                <div className="w-full md:w-80 bg-gray-700 p-6 flex flex-col gap-4 flex-shrink-0 overflow-y-auto">
                    <h3 className="text-xl font-bold text-gray-200 border-b border-gray-600 pb-2">Edit Design</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="text-input">Text</label>
                        <input id="text-input" type="text" value={text.content} onChange={handleTextChange} className="w-full bg-gray-800 border border-gray-600 text-white rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="size-input">Font Size ({text.size}px)</label>
                        <input id="size-input" type="range" min="12" max="256" value={text.size} onChange={handleSizeChange} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="color-input">Color</label>
                        <input id="color-input" type="color" value={text.color} onChange={handleColorChange} className="w-full h-10 p-1 bg-gray-800 border border-gray-600 rounded-md cursor-pointer" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Font Family</label>
                        <div className="grid grid-cols-2 gap-2">
                            {FONT_OPTIONS.map(font => (
                                <button key={font} onClick={() => setText(prev => ({...prev, font}))} className={`text-xs py-2 rounded-md transition ${text.font === font ? 'bg-indigo-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`} style={{fontFamily: font}}>
                                    {font}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-gray-600">
                        <button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105">
                           Save Changes
                        </button>
                        <button onClick={onClose} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageEditor;
