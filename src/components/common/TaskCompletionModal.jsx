// src/components/common/TaskCompletionModal.jsx
// ============================================
// TASK COMPLETION MODAL
// ============================================
// A modal that allows homeowners to mark maintenance tasks as complete
// with optional details: cost, notes, and a photo for documentation.
//
// Usage:
// <TaskCompletionModal
//     isOpen={!!completingTask}
//     task={completingTask}
//     onClose={() => setCompletingTask(null)}
//     onComplete={(task, details) => handleComplete(task, details)}
// />

import React, { useState, useRef } from 'react';
import {
    X, Check, ChevronDown, ChevronUp, Camera,
    DollarSign, FileText, User, Loader2, Trash2
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import toast from 'react-hot-toast';

// ============================================
// MAIN COMPONENT
// ============================================
export const TaskCompletionModal = ({
    isOpen,
    task,
    onClose,
    onComplete,
    userId
}) => {
    const [showDetails, setShowDetails] = useState(false);
    const [cost, setCost] = useState('');
    const [notes, setNotes] = useState('');
    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [completing, setCompleting] = useState(false);
    const fileInputRef = useRef(null);

    // Reset state when modal closes
    const handleClose = () => {
        setCost('');
        setNotes('');
        setPhoto(null);
        setPhotoPreview(null);
        setShowDetails(false);
        onClose();
    };

    // Handle photo selection
    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be less than 5MB');
            return;
        }

        setPhoto(file);

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => setPhotoPreview(e.target.result);
        reader.readAsDataURL(file);
    };

    // Remove selected photo
    const handleRemovePhoto = () => {
        setPhoto(null);
        setPhotoPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Upload photo to Firebase Storage
    const uploadPhoto = async () => {
        if (!photo || !userId) return null;

        try {
            const timestamp = Date.now();
            const fileName = `maintenance_${task.recordId}_${timestamp}.${photo.name.split('.').pop()}`;
            const storageRef = ref(storage, `users/${userId}/maintenance/${fileName}`);

            await uploadBytes(storageRef, photo);
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error('Photo upload failed:', error);
            throw error;
        }
    };

    // Handle quick complete (no details)
    const handleQuickComplete = async () => {
        setCompleting(true);
        try {
            await onComplete(task, { notes: '' });
            handleClose();
        } catch (error) {
            toast.error('Failed to complete task');
        } finally {
            setCompleting(false);
        }
    };

    // Handle complete with details
    const handleCompleteWithDetails = async () => {
        setCompleting(true);
        setUploading(photo !== null);

        try {
            let photoUrl = null;

            if (photo) {
                photoUrl = await uploadPhoto();
            }

            const details = {
                cost: cost ? parseFloat(cost) : null,
                notes: notes.trim() || null,
                photoUrl: photoUrl,
                contractor: task.contractor || null
            };

            await onComplete(task, details);
            handleClose();
        } catch (error) {
            console.error('Completion failed:', error);
            toast.error('Failed to complete task');
        } finally {
            setCompleting(false);
            setUploading(false);
        }
    };

    if (!isOpen || !task) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={handleClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Check size={20} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Complete Task</h2>
                                <p className="text-emerald-100 text-sm">{task.item}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Task Info */}
                    <div className="bg-slate-50 rounded-xl p-4 mb-4">
                        <h3 className="font-bold text-slate-800">{task.taskName}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                            <span>{task.category}</span>
                            {task.contractor && (
                                <>
                                    <span className="text-slate-300">•</span>
                                    <span className="flex items-center gap-1">
                                        <User size={12} />
                                        {task.contractor}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Quick Complete Button */}
                    <button
                        onClick={handleQuickComplete}
                        disabled={completing}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                    >
                        {completing && !showDetails ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Check size={18} />
                        )}
                        Mark as Done
                    </button>

                    {/* Toggle Details Section */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center justify-center gap-2 py-2 text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors"
                    >
                        {showDetails ? (
                            <>
                                <ChevronUp size={16} />
                                Hide Details
                            </>
                        ) : (
                            <>
                                <ChevronDown size={16} />
                                Add Cost, Notes, or Photo
                            </>
                        )}
                    </button>

                    {/* Expandable Details Section */}
                    {showDetails && (
                        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* Cost Input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                    Service Cost (optional)
                                </label>
                                <div className="relative">
                                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="number"
                                        value={cost}
                                        onChange={(e) => setCost(e.target.value)}
                                        placeholder="0.00"
                                        min="0"
                                        step="0.01"
                                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Notes Input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                    Notes (optional)
                                </label>
                                <div className="relative">
                                    <FileText size={16} className="absolute left-3 top-3 text-slate-400" />
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Any details about the service..."
                                        rows={2}
                                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                                    />
                                </div>
                            </div>

                            {/* Photo Upload */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                    Photo (optional)
                                </label>

                                {photoPreview ? (
                                    <div className="relative">
                                        <img
                                            src={photoPreview}
                                            alt="Preview"
                                            className="w-full h-32 object-cover rounded-xl border border-slate-200"
                                        />
                                        <button
                                            onClick={handleRemovePhoto}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/50 transition-colors"
                                    >
                                        <Camera size={18} />
                                        <span className="text-sm font-medium">Add Photo</span>
                                    </button>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoSelect}
                                    className="hidden"
                                />
                            </div>

                            {/* Complete with Details Button */}
                            <button
                                onClick={handleCompleteWithDetails}
                                disabled={completing}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {completing ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        {uploading ? 'Uploading...' : 'Saving...'}
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} />
                                        Complete with Details
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskCompletionModal;
