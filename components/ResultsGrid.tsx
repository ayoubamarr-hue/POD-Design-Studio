import React, { useState } from 'react';
import { DesignData } from '../types';
import { EditIcon } from './icons';

interface DesignCardProps {
  design: DesignData;
  onRemoveBackground: () => Promise<void>;
  onUpscale: () => Promise<void>;
  onRemix: () => Promise<void>;
  onRevert: () => void;
  onDownload: () => void;
  onEdit: () => void;
}

const DesignCard: React.FC<DesignCardProps> = ({ design, onRemoveBackground, onUpscale, onRemix, onRevert, onDownload, onEdit }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingText, setProcessingText] = useState('');

  const handleAction = async (action: () => Promise<void>, text: string) => {
    setIsProcessing(true);
    setProcessingText(text);
    try {
      await action();
    } finally {
      setIsProcessing(false);
      setProcessingText('');
    }
  };

  const backgroundClass = design.bgRemoved ? 'checkerboard' : 'bg-gray-900/50';
  
  return (
    <div className="bg-gray-700/50 p-4 rounded-lg flex flex-col gap-4 fade-in relative">
      {isProcessing && (
        <div className="card-loader-overlay">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-500 h-8 w-8"></div>
          {processingText && <p className="text-xs text-white mt-2">{processingText}</p>}
        </div>
      )}
      <div className={`aspect-[3/4] ${backgroundClass} rounded-md flex items-center justify-center overflow-hidden relative`}>
        <img src={design.imageUrl} alt={design.metadata.Title} className="max-w-full max-h-full object-contain" />
        {design.upscaled && (
            <div className="absolute top-2 right-2 bg-indigo-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                Upscaled 2x
            </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button 
          onClick={() => handleAction(onRemoveBackground, 'Removing BG...')} 
          className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 px-1 rounded-md transition disabled:opacity-50" 
          disabled={isProcessing}
          title="Remove Background"
        >
          BG
        </button>
        <button 
          onClick={() => handleAction(onUpscale, 'Upscaling...')} 
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-1 rounded-md transition disabled:opacity-50" 
          disabled={isProcessing}
          title="Upscale 2x"
        >
          2x
        </button>
         <button onClick={onEdit} className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold py-2 px-1 rounded-md transition disabled:opacity-50 flex items-center justify-center" disabled={isProcessing} title="Edit Design">
          <EditIcon />
        </button>
        <button onClick={() => handleAction(onRemix, 'Remixing...')} className="bg-lime-600 hover:bg-lime-700 text-white text-xs font-bold py-2 px-1 rounded-md transition disabled:opacity-50" disabled={isProcessing}>Remix</button>
        <button onClick={onRevert} className="bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold py-2 px-1 rounded-md transition disabled:opacity-50" disabled={isProcessing}>Revert</button>
        <button onClick={onDownload} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 px-1 rounded-md transition disabled:opacity-50" disabled={isProcessing}>Save</button>
      </div>
    </div>
  );
};


interface ResultsGridProps {
  designs: DesignData[];
  onRemoveBackground: (id: string) => Promise<void>;
  onUpscale: (id: string) => Promise<void>;
  onRemix: (id: string) => Promise<void>;
  onRevert: (id: string) => void;
  onEdit: (id: string) => void;
  onDownloadAll: () => void;
  onDownloadMetadata: () => void;
  onClearSession: () => void;
}

const ResultsGrid: React.FC<ResultsGridProps> = ({ designs, onRemoveBackground, onUpscale, onRemix, onRevert, onEdit, onDownloadAll, onDownloadMetadata, onClearSession }) => {
    
    const downloadSingleImage = (design: DesignData) => {
        const a = document.createElement('a');
        a.href = design.imageUrl;
        const title = design.metadata.Title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || `design_${design.id}`;
        a.download = `${title}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    if (designs.length === 0) {
        return null;
    }

  return (
    <div className="fade-in">
      <h2 className="text-3xl font-bold text-gray-200 mb-4 text-center">Generated Designs</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {designs.map((design) => (
          <DesignCard
            key={design.id}
            design={design}
            onRemoveBackground={() => onRemoveBackground(design.id)}
            onUpscale={() => onUpscale(design.id)}
            onRemix={() => onRemix(design.id)}
            onRevert={() => onRevert(design.id)}
            onEdit={() => onEdit(design.id)}
            onDownload={() => downloadSingleImage(design)}
          />
        ))}
      </div>
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
        <button onClick={onDownloadAll} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-transform transform hover:scale-105">
          Download All Images (ZIP)
        </button>
        <button onClick={onDownloadMetadata} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-8 rounded-lg transition-transform transform hover:scale-105 text-sm">
          Download Metadata
        </button>
        <button onClick={onClearSession} className="bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-8 rounded-lg transition-transform transform hover:scale-105 text-sm">
          Clear Session
        </button>
      </div>
    </div>
  );
};

export default ResultsGrid;
