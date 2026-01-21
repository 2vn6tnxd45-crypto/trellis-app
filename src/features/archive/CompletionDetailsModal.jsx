// src/features/archive/CompletionDetailsModal.jsx
// ============================================
// COMPLETION DETAILS MODAL
// ============================================
// Shows homeowners the full details of a completed job:
// - Completion photos (before/after/work)
// - Items installed (now in their inventory)
// - Contractor notes and recommendations
// - Invoice (if uploaded)
// - Maintenance schedules
//
// This gives homeowners transparency into what was done

import React, { useState } from 'react';
import {
    X,
    Camera,
    CheckCircle,
    FileText,
    Wrench,
    MessageSquare,
    Calendar,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Clock,
    AlertTriangle,
    Download,
    User,
    Phone,
    Mail,
    Home,
    Lightbulb
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

// ============================================
// HELPERS
// ============================================

const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const getPhotoTypeLabel = (type) => {
    const labels = {
        before: 'Before',
        after: 'After',
        work: 'Work in Progress'
    };
    return labels[type] || 'Photo';
};

const getPhotoTypeColor = (type) => {
    const colors = {
        before: 'bg-orange-100 text-orange-700',
        after: 'bg-green-100 text-green-700',
        work: 'bg-blue-100 text-blue-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
};

// ============================================
// PHOTO GALLERY COMPONENT
// ============================================
const PhotoGallery = ({ photos }) => {
    const [activeIndex, setActiveIndex] = useState(0);

    if (!photos || photos.length === 0) {
        return (
            <div className="bg-gray-100 rounded-xl p-8 text-center">
                <Camera className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No photos available</p>
            </div>
        );
    }

    const activePhoto = photos[activeIndex];

    return (
        <div className="space-y-3">
            {/* Main Photo */}
            <div className="relative">
                <img
                    src={activePhoto.url}
                    alt={activePhoto.caption || `Photo ${activeIndex + 1}`}
                    className="w-full h-64 object-cover rounded-xl"
                />

                {/* Type Badge */}
                <span className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium ${getPhotoTypeColor(activePhoto.type)}`}>
                    {getPhotoTypeLabel(activePhoto.type)}
                </span>

                {/* Caption */}
                {activePhoto.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-xl">
                        <p className="text-white text-sm">{activePhoto.caption}</p>
                    </div>
                )}

                {/* Navigation Arrows */}
                {photos.length > 1 && (
                    <>
                        <button
                            onClick={() => setActiveIndex(prev => prev === 0 ? photos.length - 1 : prev - 1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full shadow-lg hover:bg-white transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-gray-700" />
                        </button>
                        <button
                            onClick={() => setActiveIndex(prev => prev === photos.length - 1 ? 0 : prev + 1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full shadow-lg hover:bg-white transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-gray-700" />
                        </button>
                    </>
                )}
            </div>

            {/* Thumbnails */}
            {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map((photo, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all ${
                                idx === activeIndex
                                    ? 'ring-2 ring-emerald-500 ring-offset-2'
                                    : 'opacity-70 hover:opacity-100'
                            }`}
                        >
                            <img
                                src={photo.url}
                                alt={`Thumbnail ${idx + 1}`}
                                className="w-full h-full object-cover"
                            />
                            <span className={`absolute bottom-0 left-0 right-0 text-[9px] font-medium text-center py-0.5 ${getPhotoTypeColor(photo.type)}`}>
                                {getPhotoTypeLabel(photo.type)}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================
// ITEM CARD COMPONENT
// ============================================
const InstalledItemCard = ({ item }) => {
    const hasMaintenanceTasks = item.maintenanceTasks && item.maintenanceTasks.length > 0;
    const selectedTasks = hasMaintenanceTasks
        ? item.maintenanceTasks.filter(t => t.selected !== false)
        : [];

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Home className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-800">{item.item || item.description}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-500">
                        {item.brand && <span>{item.brand}</span>}
                        {item.model && <span>• {item.model}</span>}
                        {item.category && <span>• {item.category}</span>}
                    </div>
                </div>
                {item.cost && (
                    <span className="text-emerald-600 font-semibold">
                        {formatCurrency(item.cost)}
                    </span>
                )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                {item.serialNumber && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-slate-500 text-xs block">Serial #</span>
                        <span className="text-slate-700 font-medium">{item.serialNumber}</span>
                    </div>
                )}
                {item.area && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-slate-500 text-xs block">Location</span>
                        <span className="text-slate-700 font-medium">{item.area}</span>
                    </div>
                )}
                {item.warranty && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2 col-span-2">
                        <span className="text-slate-500 text-xs block">Warranty</span>
                        <span className="text-slate-700 font-medium">{item.warranty}</span>
                    </div>
                )}
            </div>

            {/* Maintenance Tasks */}
            {selectedTasks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Maintenance Schedule
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {selectedTasks.slice(0, 3).map((task, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded-full"
                            >
                                {task.task} ({task.frequency})
                            </span>
                        ))}
                        {selectedTasks.length > 3 && (
                            <span className="px-2 py-1 text-xs text-slate-500">
                                +{selectedTasks.length - 3} more
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN MODAL COMPONENT
// ============================================
export const CompletionDetailsModal = ({ job, onClose }) => {
    const completion = job?.completion;

    if (!completion) {
        return null;
    }

    const photos = completion.photos || [];
    const items = completion.itemsToImport || [];
    const invoice = completion.invoice;
    const notes = completion.notes;
    const recommendations = completion.recommendations;

    // Contractor info - safely extract name from contractor object to prevent React Error #310
    const getContractorDisplayName = () => {
        if (job.contractorName) return job.contractorName;
        if (job.contractorCompany) return job.contractorCompany;
        if (job.contractor) {
            if (typeof job.contractor === 'string') return job.contractor;
            if (typeof job.contractor === 'object') {
                return job.contractor.companyName || job.contractor.name || job.contractor.businessName || 'Contractor';
            }
        }
        return 'Contractor';
    };
    const contractorName = getContractorDisplayName();
    const contractorPhone = job.contractorPhone;
    const contractorEmail = job.contractorEmail;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-4 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-emerald-200" />
                            <h2 className="text-xl font-bold text-white">Job Completed</h2>
                        </div>
                        <p className="text-emerald-100 text-sm mt-0.5">
                            {job.title || job.description || 'Service'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Completion Date */}
                    <div className="flex items-center justify-between bg-white rounded-xl p-4 border border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Completed</p>
                                <p className="font-semibold text-slate-800">
                                    {formatDate(job.completedAt || completion.reviewedAt)}
                                </p>
                            </div>
                        </div>
                        {job.total > 0 && (
                            <div className="text-right">
                                <p className="text-sm text-slate-500">Total</p>
                                <p className="text-xl font-bold text-emerald-600">
                                    {formatCurrency(job.total)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Photos Section */}
                    {photos.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Camera className="w-4 h-4" />
                                Completion Photos ({photos.length})
                            </h3>
                            <PhotoGallery photos={photos} />
                        </div>
                    )}

                    {/* Items Installed Section */}
                    {items.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Wrench className="w-4 h-4" />
                                Items Installed ({items.length})
                            </h3>
                            <p className="text-sm text-slate-500 mb-3">
                                These items have been added to your home inventory.
                            </p>
                            <div className="space-y-3">
                                {items.map((item, idx) => (
                                    <InstalledItemCard key={item.id || idx} item={item} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes Section */}
                    {notes && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Contractor Notes
                            </h3>
                            <div className="bg-white rounded-xl p-4 border border-slate-200">
                                <p className="text-slate-700 whitespace-pre-wrap">{notes}</p>
                            </div>
                        </div>
                    )}

                    {/* Recommendations Section */}
                    {recommendations && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Lightbulb className="w-4 h-4" />
                                Recommendations
                            </h3>
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                <p className="text-amber-800 whitespace-pre-wrap">{recommendations}</p>
                            </div>
                        </div>
                    )}

                    {/* Invoice Section */}
                    {invoice && invoice.url && (
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Invoice
                            </h3>
                            <a
                                href={invoice.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between bg-white rounded-xl p-4 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">{invoice.fileName || 'Invoice'}</p>
                                        <p className="text-sm text-slate-500">Click to view or download</p>
                                    </div>
                                </div>
                                <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                            </a>
                        </div>
                    )}

                    {/* Contractor Section */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Work Performed By
                        </h3>
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center">
                                        <span className="text-white font-bold text-lg">
                                            {contractorName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{contractorName}</p>
                                        {contractorPhone && (
                                            <p className="text-sm text-slate-600">{contractorPhone}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Contact buttons */}
                            {(contractorPhone || contractorEmail) && (
                                <div className="flex gap-2 mt-3 pt-3 border-t border-emerald-200">
                                    {contractorPhone && (
                                        <a
                                            href={`tel:${contractorPhone}`}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white rounded-lg text-sm font-medium text-slate-700 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                                        >
                                            <Phone className="w-4 h-4" />
                                            Call
                                        </a>
                                    )}
                                    {contractorEmail && (
                                        <a
                                            href={`mailto:${contractorEmail}`}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white rounded-lg text-sm font-medium text-slate-700 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                                        >
                                            <Mail className="w-4 h-4" />
                                            Email
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Auto-completed notice */}
                    {completion.wasAutoCompleted && (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium text-amber-800">Auto-completed</p>
                                <p className="text-sm text-amber-700 mt-1">
                                    This job was automatically marked complete after the review period expired.
                                    If you have any concerns, please contact the contractor directly.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-white flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompletionDetailsModal;
