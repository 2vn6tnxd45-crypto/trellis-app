// src/features/scanner/SmartScanner.jsx
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Camera, Loader2, Check, RefreshCw, Trash2, AlertCircle, FileText, ChevronDown, User, Hash } from 'lucide-react';
import { useGemini } from '../../hooks/useGemini';
import { Camera as CameraPro } from 'react-camera-pro';

// Named export + Default export for compatibility
export const SmartScanner = ({ onClose, onScanComplete }) => {
  const [image, setImage] = useState(null);
  const [fileObj, setFileObj] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Expanded State for Detailed Fields
  const [showContractorDetails, setShowContractorDetails] = useState(false);
  
  const fileInputRef = useRef(null);
  const cameraRef = useRef(null);
  const { scanReceipt } = useGemini();

  useEffect(() => {
    setImage(null); setFileObj(null); setAnalysis(null); setError(null); setIsScanning(false);
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('File too large (Max 10MB)'); return; }
    setError(null);
    try {
      const reader = new FileReader();
      reader.onloadend = () => { setImage(reader.result); setFileObj(file); analyzeImage(file, reader.result); };
      reader.readAsDataURL(file);
    } catch (err) { setError('Failed to read file'); }
  };

  const startCamera = () => { setError(null); setIsScanning(true); };
  const takePhoto = () => {
    if (cameraRef.current) {
      const photo = cameraRef.current.takePhoto();
      fetch(photo).then(res => res.blob()).then(blob => {
        const file = new File([blob], "camera.jpg", { type: "image/jpeg" });
        setImage(photo); setFileObj(file); setIsScanning(false); analyzeImage(file, photo);
      });
    }
  };

  const analyzeImage = async (file, base64) => {
    setIsAnalyzing(true); setError(null);
    try {
      const result = await scanReceipt(file, base64);
      if (!result) throw new Error("Analysis failed");
      
      // Flatten the first item for the main form, but keep full data
      const primaryItem = result.items?.[0] || {};
      setAnalysis({
        ...result,
        itemName: primaryItem.item || result.store || 'New Item',
        category: primaryItem.category || '',
        brand: primaryItem.brand || '',
        model: primaryItem.model || '',
        serial: primaryItem.serial || '',
      });
    } catch (err) { setError('Could not analyze document. Try manual entry.'); setAnalysis(null); } 
    finally { setIsAnalyzing(false); }
  };

  const handleSave = async () => {
    if (!analysis) return;
    setIsSaving(true);
    try {
      // Pass mapped data back to app
      const recordData = {
        item: analysis.itemName,
        category: analysis.category,
        brand: analysis.brand,
        model: analysis.model,
        serialNumber: analysis.serial, // Mapping to your specific requirement
        cost: analysis.totalAmount,
        dateInstalled: analysis.date,
        
        // Contractor Data
        contractor: analysis.store,
        contractorPhone: analysis.contractorPhone,
        contractorEmail: analysis.contractorEmail,
        contractorAddress: analysis.contractorAddress,
        
        attachments: [{ name: fileObj?.name || 'Scan', type: fileObj?.type?.includes('pdf') ? 'Document' : 'Photo', url: image }]
      };
      await onScanComplete(recordData);
      onClose();
    } catch (err) { setError('Save failed'); } finally { setIsSaving(false); }
  };

  const reset = () => { setImage(null); setFileObj(null); setAnalysis(null); setIsScanning(false); };
  const isPdf = fileObj?.type === 'application/pdf';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{image ? 'Review Details' : 'Smart Scan'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500"/></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium flex gap-2"><AlertCircle size={16}/>{error}</div>}

          {!image && !isScanning && (
            <div className="space-y-6">
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:bg-gray-50 cursor-pointer transition-colors">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600"><Upload size={32}/></div>
                <p className="font-bold text-gray-900">Click to Upload Invoice/Receipt</p>
                <p className="text-sm text-gray-500 mt-1">PDF or Image (Max 10MB)</p>
              </div>
              <div className="relative text-center"><span className="bg-white px-3 text-sm text-gray-400 relative z-10">OR</span><div className="absolute top-1/2 w-full border-t border-gray-100"></div></div>
              <button onClick={startCamera} className="w-full py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"><Camera size={20}/> Take Photo</button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileSelect}/>
            </div>
          )}

          {isScanning && (
            <div className="h-96 bg-black rounded-xl overflow-hidden relative">
              <CameraPro ref={cameraRef} aspectRatio={4/3} />
              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 px-6">
                <button onClick={() => setIsScanning(false)} className="px-6 py-3 bg-white/20 backdrop-blur-md text-white font-bold rounded-full">Cancel</button>
                <button onClick={takePhoto} className="px-8 py-3 bg-white text-black font-bold rounded-full">Capture</button>
              </div>
            </div>
          )}

          {image && !isScanning && (
            <div className="space-y-6">
              {/* Preview */}
              <div className="relative bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shrink-0 h-48 flex items-center justify-center group">
                {isPdf ? <div className="text-center text-gray-500"><FileText className="w-12 h-12 mx-auto mb-2"/><p className="text-xs font-bold">{fileObj?.name}</p></div> : <img src={image} className="h-full w-full object-contain" alt="Scan"/>}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={reset} className="p-2 bg-white rounded-full text-red-600"><Trash2 size={20}/></button>
                </div>
              </div>

              {/* Form Fields */}
              {isAnalyzing ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-10 bg-gray-100 rounded-xl w-full"/>
                  <div className="h-10 bg-gray-100 rounded-xl w-full"/>
                  <div className="h-20 bg-gray-100 rounded-xl w-full"/>
                </div>
              ) : analysis ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  {/* Basic Info */}
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Item / Service Name</label>
                    <input value={analysis.itemName} onChange={e => setAnalysis({...analysis, itemName: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"/>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Cost</label>
                        <input type="number" value={analysis.totalAmount} onChange={e => setAnalysis({...analysis, totalAmount: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-900"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                        <input type="date" value={analysis.date} onChange={e => setAnalysis({...analysis, date: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-900"/>
                    </div>
                  </div>

                  {/* Technical Specs Section */}
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                    <h4 className="text-xs font-bold text-blue-800 uppercase flex items-center"><Hash size={12} className="mr-1"/> Equipment Specs</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Brand" value={analysis.brand} onChange={e => setAnalysis({...analysis, brand: e.target.value})} className="p-2 bg-white border border-blue-200 rounded-lg text-sm"/>
                        <input placeholder="Model #" value={analysis.model} onChange={e => setAnalysis({...analysis, model: e.target.value})} className="p-2 bg-white border border-blue-200 rounded-lg text-sm"/>
                        <input placeholder="Serial #" value={analysis.serial} onChange={e => setAnalysis({...analysis, serial: e.target.value})} className="col-span-2 p-2 bg-white border border-blue-200 rounded-lg text-sm"/>
                    </div>
                  </div>

                  {/* Contractor Section */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <button onClick={() => setShowContractorDetails(!showContractorDetails)} className="w-full flex justify-between items-center text-xs font-bold text-gray-500 uppercase">
                        <span className="flex items-center"><User size={12} className="mr-1"/> Contractor Info</span>
                        <ChevronDown size={14} className={`transform transition-transform ${showContractorDetails ? 'rotate-180' : ''}`}/>
                    </button>
                    
                    {(showContractorDetails || analysis.store) && (
                        <div className="mt-3 space-y-3">
                            <input placeholder="Company Name" value={analysis.store} onChange={e => setAnalysis({...analysis, store: e.target.value})} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"/>
                            <div className="grid grid-cols-2 gap-3">
                                <input placeholder="Phone" value={analysis.contractorPhone} onChange={e => setAnalysis({...analysis, contractorPhone: e.target.value})} className="p-2 bg-white border border-gray-200 rounded-lg text-sm"/>
                                <input placeholder="Email" value={analysis.contractorEmail} onChange={e => setAnalysis({...analysis, contractorEmail: e.target.value})} className="p-2 bg-white border border-gray-200 rounded-lg text-sm"/>
                            </div>
                            <input placeholder="Address" value={analysis.contractorAddress} onChange={e => setAnalysis({...analysis, contractorAddress: e.target.value})} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"/>
                        </div>
                    )}
                  </div>

                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        {image && !isScanning && (
            <div className="p-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
                <button onClick={reset} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Retake</button>
                <button onClick={handleSave} disabled={!analysis || isSaving} className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 className="animate-spin"/> : <Check/>} Save Record
                </button>
            </div>
        )}
      </motion.div>
    </div>
  );
};

export default SmartScanner;
