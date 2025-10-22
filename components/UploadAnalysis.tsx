
import React from 'react';
import { AnalysisResult, InspirationAnalysis, PrintReport, InspirationIdea } from '../types';
import { UploadIcon } from './icons';

interface PrintCheckReportProps {
    report: PrintReport;
    imageUrl: string;
}

const PrintCheckReportDisplay: React.FC<PrintCheckReportProps> = ({ report, imageUrl }) => {
    const getStatusColor = (status: string) => {
        if (status === '✅') return 'text-green-400';
        if (status === '⚠️') return 'text-yellow-400';
        if (status === '❌') return 'text-red-400';
        return 'text-gray-400';
    };

    const ReportItem: React.FC<{item: any, title: string}> = ({ item, title }) => {
        if (!item) return null;
        return (
            <div className="flex items-start gap-3">
                <div className={`text-xl leading-none ${getStatusColor(item.status)}`}>{item.status}</div>
                <div>
                    <p className="font-semibold text-gray-300">{title}</p>
                    <p className="text-xs text-gray-400">{item.details}</p>
                    {item.suggestion && <p className="text-xs text-indigo-300 mt-1">Suggestion: {item.suggestion}</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-lg font-semibold text-gray-200 mb-4">Print Readiness Report</h4>
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 p-2 rounded-lg bg-gray-900/50">
                    <img src={imageUrl} className="w-16 h-16 rounded-md object-cover checkerboard" alt="Uploaded design preview" />
                    <p className="text-sm font-medium">Analysis of your uploaded design.</p>
                </div>
                <ReportItem item={report.resolution} title="Resolution" />
                <ReportItem item={report.color_safety} title="Color Safety" />
                <ReportItem item={report.text_readability} title="Text Readability" />
                <ReportItem item={report.transparency} title="Transparency" />
                <ReportItem item={report.edge_clarity} title="Edge Clarity" />
            </div>
        </div>
    );
};

interface InspirationResultsProps {
    data: InspirationAnalysis;
    onGenerateFromIdea: (description: string) => void;
}

const InspirationResultsDisplay: React.FC<InspirationResultsProps> = ({ data, onGenerateFromIdea }) => {
    return (
        <div>
            <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-200 mb-3">AI Design Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><strong className="text-gray-400">Theme:</strong> {data.theme || 'N/A'}</div>
                    <div><strong className="text-gray-400">Style:</strong> {data.style || 'N/A'}</div>
                    {data.text && <div><strong className="text-gray-400">Detected Text:</strong> "{data.text}"</div>}
                    {data.colors && data.colors.length > 0 && (
                        <div className="flex items-center gap-2 col-span-1 md:col-span-2">
                            <strong className="text-gray-400">Colors:</strong>
                            {data.colors.map((color, i) => <div key={i} className="w-5 h-5 rounded-full border-2 border-gray-600" style={{ backgroundColor: color }}></div>)}
                        </div>
                    )}
                </div>
            </div>
            <h4 className="text-lg font-semibold text-gray-200 mt-6 mb-3">New Design Ideas</h4>
            <div className="flex flex-col gap-4">
                {data.ideas.map((idea: InspirationIdea, i: number) => (
                    <div key={i} className="bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h5 className="font-bold text-indigo-300">{idea.title}</h5>
                            <p className="text-gray-400 text-sm mt-1">{idea.description}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {idea.tags && idea.tags.map((tag, j) => <span key={j} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full">{tag}</span>)}
                            </div>
                        </div>
                        <button onClick={() => onGenerateFromIdea(idea.description)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm flex-shrink-0 w-full sm:w-auto">
                            Generate
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};


interface UploadAnalysisProps {
  onImageUpload: (file: File) => void;
  analysisResult: AnalysisResult;
  isAnalyzing: boolean;
  onGenerateFromIdea: (description: string) => void;
}

const UploadAnalysis: React.FC<UploadAnalysisProps> = ({ onImageUpload, analysisResult, isAnalyzing, onGenerateFromIdea }) => {
    const [fileName, setFileName] = React.useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            onImageUpload(file);
        }
    };
    
  return (
    <div className="mb-6 bg-gray-700/50 p-6 rounded-lg">
      <h2 className="text-2xl font-bold text-gray-200 mb-4 text-center">Upload & Inspire</h2>
      <p className="text-center text-gray-400 mb-4">Upload a t-shirt design to get new ideas and check print-readiness.</p>
      
      <div className="relative overflow-hidden inline-block w-full">
        <div className="border-2 dashed border-gray-600 text-gray-400 bg-gray-800 p-10 rounded-lg cursor-pointer text-center w-full transition hover:border-indigo-500 hover:text-white">
          <UploadIcon />
          <span className="mt-2 block text-sm font-medium">{fileName || 'Click to upload an image'}</span>
          <span className="mt-1 block text-xs text-gray-500">PNG or JPG</span>
        </div>
        <input type="file" className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" accept="image/png, image/jpeg" onChange={handleFileChange} />
      </div>

      {isAnalyzing && (
        <div className="text-center p-8">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-500 h-12 w-12 mx-auto mb-4"></div>
          <p className="text-gray-400">Analyzing your design...</p>
        </div>
      )}

      {!isAnalyzing && (analysisResult.printReport || analysisResult.inspiration) && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analysisResult.printReport && analysisResult.uploadedImage && <PrintCheckReportDisplay report={analysisResult.printReport} imageUrl={analysisResult.uploadedImage} />}
            {analysisResult.inspiration && <InspirationResultsDisplay data={analysisResult.inspiration} onGenerateFromIdea={onGenerateFromIdea} />}
        </div>
      )}
    </div>
  );
};

export default UploadAnalysis;
