// src/lib/pdfUtils.js
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker using the version from the installed package
// This URL structure works well with Vercel/Vite builds
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const generatePDFThumbnail = async (file) => {
    if (file.type !== 'application/pdf') return null;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); // Get page 1

        const viewport = page.getViewport({ scale: 1.5 }); // 1.5 scale for better quality
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.8);
        });
    } catch (error) {
        console.error("PDF Thumbnail Error:", error);
        return null;
    }
};
