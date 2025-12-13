// src/features/scanner/SmartScanner.jsx
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Camera, Loader2, Check, RefreshCw, Trash2, AlertCircle, FileText } from 'lucide-react';
import { useGemini } from '../../hooks/useGemini';
import { Camera as CameraPro } from 'react-camera-pro';

export const SmartScanner = ({ onClose, onScanComplete }) => {
  const [image, setImage] = useState(null); // Stores the Base64 string for display/sending
  const [fileObj, setFileObj] = useState(null); // Stores the raw file object for the AI
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const cameraRef = useRef(null);
  const { scanReceipt } = useGemini();

  // Reset state when reopening
  useEffect(() => {
    setImage(null);
    setFileObj(null);
    setAnalysis(null);
    setError(null);
    setIsScanning(false);
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size too large. Please choose a file under 10MB.');
      return;
    }

    setError(null);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Result = reader.result;
        setImage(base64Result);
        setFileObj(file);
        // Pass BOTH the file object and the base64 string
        analyzeImage(file, base64Result);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to read file. Please try again.');
      console.error('Error reading file:', err);
    }
  };

  const startCamera = () => {
    setError(null);
    setIsScanning(true);
  };

  const takePhoto = () => {
    if (cameraRef.current) {
      try {
        const photo = cameraRef.current.takePhoto();
        // Convert base64 to a file-like object for consistency
        fetch(photo)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
            setImage(photo);
            setFileObj(file);
            setIsScanning(false);
            analyzeImage(file, photo);
          });
      } catch (err) {
        setError('Failed to take photo. Please try uploading a file instead.');
        setIsScanning(false);
      }
    }
  };

  const analyzeImage = async (file, base64Image) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      // scanReceipt expects (file, base64String)
      const result = await scanReceipt(file, base64Image);
      if (!result) throw new Error("No data returned");
      setAnalysis(result);
    } catch (err) {
      setError('Failed to analyze document. Please try again or enter details manually.');
      console.error('Analysis failed:', err);
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!analysis) return;
    
    setIsSaving(true);
    try {
      const recordData = {
        ...analysis,
        type: 'receipt',
        date: analysis.date || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        // Only include image preview if it's an image, otherwise null or icon
        imageUrl: fileObj?.type?.includes('image') ? image : null,
        attachments: [{
            name: fileObj?.name || 'Scan',
            type: fileObj?.type?.includes('pdf') ? 'Document' : 'Photo',
            url: image // In a real app, this would be the Firebase Storage URL after upload
        }]
      };
      
      await onScanComplete(recordData);
      onClose();
    } catch (err) {
      setError('Failed to save record. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetScanner = () => {
    setImage(null);
    setFileObj(null);
    setAnalysis(null);
    setError(null);
    setIsScanning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper to check if current file is PDF
  const isPdf = fileObj?.type === 'application/pdf';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl w-full max-w-lg overflow-hidden relative flex flex-col shadow-xl max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {image ? 'Review Document' : 'Scan Invoice or Receipt'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-xl flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* State 1: Initial Selection */}
          {!image && !isScanning && (
            <div className="space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-sage-500 hover:bg-sage-50 transition-all cursor-pointer group"
              >
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-sage-100 transition-colors">
                  <Upload className="w-8 h-8 text-gray-400 group-hover:text-sage-600 transition-colors" />
                </div>
                <p className="text-base text-gray-900 font-medium mb-2">Click or drag to upload</p>
                <p className="text-sm text-gray-500">PDF, PNG, JPG up to 10MB</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf" // Added PDF support
                onChange={handleFileSelect}
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-white text-sm text-gray-500 font-medium">or</span>
                </div>
              </div>

              <button
                onClick={startCamera}
                className="w-full py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Camera className="w-5 h-5" />
                Use Camera
              </button>
            </div>
          )}

          {/* State 2: Active Camera View */}
          {isScanning && (
            <div className="space-y-4">
               <div className="h-[400px] bg-black relative rounded-xl overflow-hidden">
                <CameraPro ref={cameraRef} aspectRatio={4 / 3} />
                <div className="absolute inset-0 border-[3px] border-white/30 m-8 rounded-lg pointer-events-none">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-white/70 text-sm font-medium bg-black/50 px-4 py-2 rounded-full">
                      Position document within frame
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsScanning(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={takePhoto}
                  className="flex-1 py-3 bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <Camera className="w-5 h-5" />
                  Capture
                </button>
              </div>
            </div>
          )}

          {/* State 3: Preview & Results */}
          {image && !isScanning && (
            <div className="flex flex-col space-y-6">
              
              {/* Preview Container - Handles both Images and PDFs */}
              <div className="relative rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 group">
                {isPdf ? (
                    // PDF View
                    <div className="w-full h-[200px] flex flex-col items-center justify-center bg-gray-50 text-gray-500">
                        <FileText className="w-16 h-16 text-sage-500 mb-2" />
                        <p className="text-sm font-medium text-gray-900">{fileObj?.name}</p>
                        <p className="text-xs">PDF Document</p>
                    </div>
                ) : (
                    // Image View
                    <img 
                      src={image} 
                      alt="Document content" 
                      className="w-full h-auto object-contain max-h-[300px] mx-auto" 
                    />
                )}
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                    title="Replace File"
                   >
                    <RefreshCw className="w-5 h-5 text-gray-700" />
                  </button>
                  <button 
                    onClick={resetScanner}
                    className="p-2 bg-white/90 rounded-full hover:bg-red-50 transition-colors"
                    title="Delete and Start Over"
                  >
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </button>
                </div>
              </div>

              {/* Analysis Results Form */}
              {analysis && !isAnalyzing && (
                <div className="space-y-4 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Merchant / Item Name</label>
                    <input
                      type="text"
                      value={analysis.merchantName || analysis.itemName || analysis.store || ''}
                      onChange={(e) => setAnalysis(prev => ({ ...prev, merchantName: e.target.value, itemName: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-colors"
                      placeholder="e.g., Home Depot"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                        <input
                          type="number"
                          value={analysis.totalAmount || ''}
                          onChange={(e) => setAnalysis(prev => ({ ...prev, totalAmount: e.target.value }))}
                          className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-colors"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={analysis.date || ''}
                        onChange={(e) => setAnalysis(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-colors"
                      />
                    </div>
                  </div>

                   <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={analysis.category || ''}
                      onChange={(e) => setAnalysis(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-colors appearance-none"
                    >
                      <option value="">Select a category</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="repair">Repair</option>
                      <option value="improvement">Improvement</option>
                      <option value="appliance">Appliance</option>
                      <option value="service">Service</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Loading Skeletons */}
              {isAnalyzing && !analysis && !error && (
                <div className="space-y-4 shrink-0">
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                      <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                      <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {image && !isScanning && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0">
            <div className="flex gap-3">
              <button
                onClick={resetScanner}
                className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                disabled={isSaving}
              >
                Retake
              </button>
              <button
                onClick={handleSave}
                disabled={!analysis || isSaving || isAnalyzing || !!error}
                className="flex-1 py-3 bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : analysis ? (
                  <>
                    <Check className="w-5 h-5" />
                    Save Record
                  </>
                ) : (
                  'Awaiting Analysis'
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SmartScanner;
