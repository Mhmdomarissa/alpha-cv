'use client';
import React, { useState, useEffect, useRef } from 'react';
import { X, Download, ZoomIn, ZoomOut, Maximize2, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button-enhanced';
import { Badge } from '@/components/ui/badge';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
    const [numPages, setNumPages] = useState<number | null>(null);
    const [scale, setScale] = useState(1.0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const isPdf = fileName.toLowerCase().endsWith('.pdf');

    // Measure container width so PDF page can scale to fit (avoids right-side clipping)
    useEffect(() => {
        if (!isOpen || !isPdf) return;
        const el = scrollContainerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const { width } = entries[0]?.contentRect ?? {};
            if (typeof width === 'number' && width > 0) setContainerWidth(width);
        });
        ro.observe(el);
        setContainerWidth(el.getBoundingClientRect().width);
        return () => ro.disconnect();
    }, [isOpen, isPdf]);

    useEffect(() => {
        if (isOpen) {
            setLoading(isPdf);
            setError(null);
        }
    }, [isOpen, fileUrl, isPdf]);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setLoading(false);
    }

    function onDocumentLoadError(err: Error) {
        console.error('PDF load error:', err);
        setError('Failed to load PDF document.');
        setLoading(false);
    }

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
                <DialogHeader className="p-4 bg-gray-800 border-b border-gray-700 flex flex-row items-center justify-between text-white space-y-0">
                    <DialogTitle className="text-lg font-medium truncate flex-1 mr-4">
                        Preview: {fileName}
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleDownload} className="text-gray-300 hover:text-white hover:bg-gray-700">
                            <Download className="w-4 h-4 mr-2" />
                            Download
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-300 hover:text-white hover:bg-gray-700 h-8 w-8 p-0">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </DialogHeader>

                <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-gray-900 flex flex-col items-center p-4 relative min-w-0">
                    {loading && isPdf && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                        </div>
                    )}

                    {error && isPdf && (
                        <div className="flex flex-col items-center justify-center text-gray-400 p-8">
                            <p className="text-red-400 mb-4">{error}</p>
                            <Button onClick={() => window.open(fileUrl, '_blank')}>
                                Open in New Tab
                            </Button>
                        </div>
                    )}

                    {isPdf ? (
                        <div className="flex flex-col items-center gap-4 w-full min-w-0">
                            <Document
                                file={fileUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={onDocumentLoadError}
                                loading={null}
                            >
                                {numPages != null && numPages > 0 && (
                                    <>
                                        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                                            <div key={pageNum} className="shadow-2xl bg-white">
                                                <Page
                                                    pageNumber={pageNum}
                                                    width={containerWidth > 0 ? containerWidth * scale : undefined}
                                                    scale={containerWidth > 0 ? undefined : scale}
                                                    renderAnnotationLayer={true}
                                                    renderTextLayer={true}
                                                />
                                            </div>
                                        ))}
                                    </>
                                )}
                            </Document>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col h-full">
                            {extractedText ? (
                                <div className="flex-1 bg-gray-800 rounded-lg p-8 overflow-auto shadow-inner border border-gray-700">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="text-indigo-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                                            <FileText className="w-4 h-4" /> Raw Document Content (Extracted)
                                        </h3>
                                        <Badge variant="outline" className="text-gray-400 border-gray-700">
                                            {extractedText.length} characters
                                        </Badge>
                                    </div>
                                    <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                                        {extractedText}
                                    </pre>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-gray-400 p-8 h-full">
                                    <div className="bg-gray-800 p-12 rounded-2xl shadow-xl flex flex-col items-center max-w-md text-center">
                                        <div className="w-20 h-20 bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                                            <Maximize2 className="w-10 h-10 text-indigo-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Non-PDF Preview</h3>
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

                {isPdf && numPages != null && numPages > 0 && (
                    <div className="bg-gray-800 border-t border-gray-700 p-3 flex items-center justify-between shrink-0">
                        <span className="text-sm text-gray-300">
                            {numPages} page{numPages !== 1 ? 's' : ''} · Scroll to view
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                                className="text-gray-300 hover:text-white"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </Button>
                            <span className="text-xs text-gray-400 w-12 text-center">
                                {Math.round(scale * 100)}%
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setScale(s => Math.min(2.0, s + 0.1))}
                                className="text-gray-300 hover:text-white"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
