// src/features/scanner/SmartScanner.jsx
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Camera, Loader2, Check, RefreshCw, Trash2, AlertCircle, FileText, ChevronDown, User, Hash, Plus, Minus } from 'lucide-react';
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
  
  // UI States
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
      
      // Store the full result including all items
      setAnalysis({
        ...result,
        // Ensure items array exists
        items: result.items || [],
        // Default top-level fields for fallback
        itemName: result.primaryJobDescription || result.items?.[0]?.item || 'New Item',
      });
      
      if (result.vendorName || result.vendorPhone) setShowContractorDetails(true);

    } catch (err) { setError('Could not analyze document. Try manual entry.'); setAnalysis(null); } 
    finally { setIsAnalyzing(false); }
  };

  const handleSave = async () => {
    if (!analysis) return;
    setIsSaving(true);
    try {
      // Prepare the package. If we have multiple items, send them all.
      // App.jsx will detect 'items' array and switch to Batch Mode.
      const recordData = {
        // Global Invoice Data
        date: analysis.date,
        contractor: analysis.vendorName,
        contractorPhone: analysis.vendorPhone,
        contractorEmail: analysis.vendorEmail,
        contractorAddress: analysis.vendorAddress,
        
        // Pass the full list of items found
        items: analysis.items.map(item => ({
            item: item.item,
            category: item.category,
            brand: item.brand,
            model: item.model,
            serial: item.serial, // Ensure serial maps correctly
            cost: item.cost,
            // Fallback to global data if item is missing it
            dateInstalled: analysis.date,
            contractor: analysis.vendorName
        })),
        
        // Primary Item Fallback (for single item logic)
        item: analysis.items?.[0]?.item || analysis.primaryJobDescription,
        cost: analysis.totalAmount, // Overall invoice total
        
        attachments: [{ name: fileObj?.name || 'Scan', type: fileObj?.type?.includes('pdf') ? 'Document' : 'Photo', url: image }]
      };
      
      await onScanComplete(recordData);
      onClose();
    } catch (err) { setError('Save failed'); } finally { setIsSaving(false); }
  };

  const removeItem = (index) => {
      const newItems = [...analysis.items];
      newItems.splice(index, 1);
      setAnalysis({ ...analysis, items: newItems });
  };

  const reset = () => { setImage(null); setFileObj(null); setAnalysis(null); setIsScanning(false); };
  const isPdf = fileObj?.type === 'application/pdf';

  return (
    // Z-INDEX FIX: Changed from z-50 to z-[100] to sit above BottomNav
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{image ? 'Review Details' : 'Smart Scan'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium flex gap-2"><AlertCircle size={16}/>{error}</div>}

          {!image && !isScanning && (
            <div className="space-y-6">
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:bg-gray-50 cursor-pointer transition-colors">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600"><Upload size={32}/></div>
                <p className="font-bold text-gray-900">Upload Invoice/Receipt</p>
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

              {isAnalyzing ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-10 bg-gray-100 rounded-xl w-full"/>
                  <div className="h-10 bg-gray-100 rounded-xl w-full"/>
                  <div className="h-20 bg-gray-100 rounded-xl w-full"/>
                </div>
              ) : analysis ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  
                  {/* Summary Section */}
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <div className="flex justify-between items-start mb-2">
                          <div>
                              <p className="text-xs font-bold text-emerald-700 uppercase">Total Invoice</p>
                              <p className="text-xl font-extrabold text-emerald-900">${analysis.totalAmount}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-xs font-bold text-emerald-700 uppercase">Date</p>
                              <p className="font-medium text-emerald-900">{analysis.date}</p>
                          </div>
                      </div>
                      <p className="text-xs text-emerald-600 font-medium border-t border-emerald-200/50 pt-2 mt-2">
                          Job: {analysis.primaryJobDescription || 'General Service'}
                      </p>
                  </div>

                  {/* Detected Items List - NEW UI for Multiple Items */}
                  <div>
                      <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-bold text-gray-500 uppercase">Detected Line Items ({analysis.items.length})</label>
                      </div>
                      <div className="space-y-2">
                          {analysis.items.map((item, idx) => (
                              <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 relative group">
                                  <div className="flex-grow min-w-0">
                                      <p className="font-bold text-gray-800 truncate">{item.item}</p>
                                      <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                                          <span>{item.category}</span>
                                          {item.model && <span>• {item.model}</span>}
                                          {item.cost > 0 && <span className="text-emerald-600 font-bold">• ${item.cost}</span>}
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => removeItem(idx)} 
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                      <Trash2 size={16}/>
                                  </button>
                              </div>
                          ))}
                          {analysis.items.length === 0 && (
                              <p className="text-sm text-gray-400 italic text-center py-2">No items detected. Try retaking.</p>
                          )}
                      </div>
                  </div>

                  {/* Contractor Section (Collapsible) */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <button onClick={() => setShowContractorDetails(!showContractorDetails)} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <span className="text-xs font-bold text-gray-600 uppercase flex items-center"><User size={14} className="mr-2"/> Contractor Info</span>
                        <ChevronDown size={14} className={`text-gray-400 transform transition-transform ${showContractorDetails ? 'rotate-180' : ''}`}/>
                    </button>
                    
                    {showContractorDetails && (
                        <div className="p-4 space-y-3 border-t border-gray-100">
                            <input placeholder="Company Name" value={analysis.vendorName} onChange={e => setAnalysis({...analysis, vendorName: e.target.value})} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"/>
                            <div className="grid grid-cols-2 gap-3">
                                <input placeholder="Phone" value={analysis.vendorPhone} onChange={e => setAnalysis({...analysis, vendorPhone: e.target.value})} className="p-2 bg-white border border-gray-200 rounded-lg text-sm"/>
                                <input placeholder="Email" value={analysis.vendorEmail} onChange={e => setAnalysis({...analysis, vendorEmail: e.target.value})} className="p-2 bg-white border border-gray-200 rounded-lg text-sm"/>
                            </div>
                            <input placeholder="Address" value={analysis.vendorAddress} onChange={e => setAnalysis({...analysis, vendorAddress: e.target.value})} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"/>
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
                    {isSaving ? <Loader2 className="animate-spin"/> : <Check/>} 
                    {analysis?.items?.length > 1 ? `Save ${analysis.items.length} Items` : 'Save Record'}
                </button>
            </div>
        )}
      </motion.div>
    </div>
  );
};

export default SmartScanner;
