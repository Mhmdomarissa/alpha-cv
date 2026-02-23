'use client';
import React, { useState, useEffect } from 'react';
import { X, Download, Maximize2, FileText } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';

interface FilePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    fileName: string;
    fileId: string;
    fileType: string;
    extractedText?: string;
}

export function FilePreviewModal({ isOpen, onClose, fileUrl, fileName, fileId, fileType, extractedText }: FilePreviewModalProps) {
    const [iframeLoaded, setIframeLoaded] = useState(false);

    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    const isDocx = fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc');
    const useNativeView = isPdf || isDocx;

    useEffect(() => {
        if (isOpen && useNativeView) setIframeLoaded(false);
    }, [isOpen, fileUrl, useNativeView]);

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl w-[90vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-gray-900 border-gray-800">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="absolute top-2 right-2 z-20 h-8 w-8 p-0 rounded-full bg-gray-800/90 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-600"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </Button>

                <div className="flex-1 flex flex-col min-h-0 relative bg-white">
                    {useNativeView ? (
                        <>
                            {!iframeLoaded && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10">
                                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent mb-3" />
                                    <p className="text-gray-600 text-sm">Loading document…</p>
                                </div>
                            )}
                            <iframe
                                src={fileUrl}
                                title={`Preview: ${fileName}`}
                                className="flex-1 w-full min-h-0 border-0"
                                onLoad={() => setIframeLoaded(true)}
                            />
                        </>
                    ) : (
                        <div className="flex-1 overflow-auto p-6">
                            {extractedText ? (
                                <div className="bg-gray-800 rounded-lg p-8 overflow-auto shadow-inner border border-gray-700">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="text-indigo-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                                            <FileText className="w-4 h-4" /> Raw Document Content (Extracted)
                                        </h3>
                                        <Badge variant="outline" className="text-gray-400 border-gray-700">
                                            {extractedText.length} characters
                                        </Badge>
                                    </div>
                                    <pre className="text-gray-200 whitespace-pre-wrap font-mono text-base leading-relaxed" style={{ fontFamily: 'ui-monospace, monospace' }}>
                                        {extractedText}
                                    </pre>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-gray-400 p-8 h-full">
                                    <div className="bg-gray-800 p-12 rounded-2xl shadow-xl flex flex-col items-center max-w-md text-center">
                                        <div className="w-20 h-20 bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                                            <Maximize2 className="w-10 h-10 text-indigo-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Preview Not Available</h3>
                                        <p className="text-gray-400 mb-8">
                                            Direct preview for {fileName.split('.').pop()?.toUpperCase()} files is limited.
                                            You can view the extracted content or download the original file.
                                        </p>
                                        <div className="flex gap-4">
                                            <Button variant="primary" onClick={handleDownload}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Download Original
                                            </Button>
                                            <Button variant="outline" onClick={() => window.open(fileUrl, '_blank')} className="border-gray-600 text-gray-300 hover:bg-gray-800">
                                                Open File
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
