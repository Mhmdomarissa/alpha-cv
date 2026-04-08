'use client';
import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Maximize2, FileText } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
    /** When provided, DOCX preview uses this blob instead of fetching fileUrl (avoids empty response / CORS) */
    blob?: Blob | null;
}

export function FilePreviewModal({ isOpen, onClose, fileUrl, fileName, fileId, fileType, extractedText, blob: blobProp }: FilePreviewModalProps) {
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [docxReady, setDocxReady] = useState(false);
    const [docxError, setDocxError] = useState(false);
    const [containerMounted, setContainerMounted] = useState(false);
    const docxContainerRef = useRef<HTMLDivElement>(null);

    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    const isDocx = fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc');
    const usePdfIframe = isPdf;

    useEffect(() => {
        if (isOpen && usePdfIframe) setIframeLoaded(false);
    }, [isOpen, fileUrl, usePdfIframe]);

    // Render DOCX with docx-preview; use blob prop when provided to avoid refetch (0 B) issues
    useEffect(() => {
        if (!isOpen || !isDocx) {
            setDocxReady(false);
            setDocxError(false);
            setContainerMounted(false);
            return;
        }
        const container = docxContainerRef.current;
        if (!container) return;
        setDocxReady(false);
        setDocxError(false);
        container.innerHTML = '';
        let cancelled = false;
        (async () => {
            try {
                let blob: Blob;
                if (blobProp && blobProp.size > 0) {
                    blob = blobProp;
                } else if (fileUrl) {
                    const res = await fetch(fileUrl);
                    if (!res.ok) throw new Error('Failed to load document');
                    blob = await res.blob();
                    if (blob.size === 0) throw new Error('Document is empty');
                } else {
                    throw new Error('No file source');
                }
                if (cancelled) return;
                await renderAsync(blob, container);
                if (!cancelled) setDocxReady(true);
            } catch (e) {
                if (!cancelled) setDocxError(true);
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen, isDocx, fileUrl, blobProp, containerMounted]);

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
                <DialogTitle className="sr-only">Preview: {fileName}</DialogTitle>
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
                    {usePdfIframe ? (
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
                    ) : isDocx ? (
                        <>
                            {!docxReady && !docxError && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10">
                                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent mb-3" />
                                    <p className="text-gray-600 text-sm">Loading document…</p>
                                </div>
                            )}
                            {docxError && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10 p-6">
                                    <p className="text-red-600 mb-4">Could not preview this document.</p>
                                    <Button variant="primary" onClick={handleDownload}>
                                        <Download className="w-4 h-4 mr-2" />
                                        Download
                                    </Button>
                                </div>
                            )}
                            <div
                                ref={(el) => {
                                    (docxContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                                    setContainerMounted(!!el);
                                }}
                                className="docx-container flex-1 overflow-auto p-6 min-h-0"
                                style={{ background: '#fff' }}
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
