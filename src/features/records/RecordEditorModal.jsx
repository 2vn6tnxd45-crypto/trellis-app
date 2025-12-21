// src/features/records/RecordEditorModal.jsx
import React, { useState, useEffect } from 'react';
import { doc, collection, addDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import { calculateNextDate } from '../../lib/utils';
import { generatePDFThumbnail } from '../../lib/pdfUtils';
import { AddRecordForm } from './AddRecordForm';
import { REQUESTS_COLLECTION_PATH } from '../../config/constants';

export const RecordEditorModal = ({ user, db, storage, appId, profile, activeProperty, editingRecord, onClose, onSuccess, existingRecords }) => {
    const initial = { category: '', item: '', brand: '', model: '', warranty: '', notes: '', area: '', maintenanceFrequency: 'none', dateInstalled: new Date().toISOString().split('T')[0], attachments: [] };
    const [newRecord, setNewRecord] = useState(editingRecord || initial);
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (editingRecord) setNewRecord(editingRecord); }, [editingRecord]);
    const handleChange = (e) => setNewRecord({...newRecord, [e.target.name]: e.target.value});
    
    const handleAttachmentsChange = async (files) => {
        const placeholders = await Promise.all(files.map(async f => {
            const isPdf = f.type.includes('pdf');
            let thumbnailBlob = null;
            if (isPdf) thumbnailBlob = await generatePDFThumbnail(f);
            return { name: f.name, size: f.size, type: isPdf ? 'Document' : 'Photo', fileRef: f, thumbnailRef: thumbnailBlob };
        }));
        setNewRecord(p => ({ ...p, attachments: [...(p.attachments||[]), ...placeholders] }));
    };
    
    const parseCost = (val) => {
        if (!val) return 0;
        const clean = String(val).replace(/[^0-9.]/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    };

    const handleBatchSave = async (items, file, contractorOverrides = {}) => {
    if (!items || items.length === 0) return;
    setSaving(true);
    try {
        let sharedImageUrl = null;
        let sharedFileType = 'Photo';
        let sharedFileUrl = null;
        const fileToUpload = file || editingRecord?.attachments?.[0]?.fileRef;

        if (fileToUpload) {
            const isPdf = fileToUpload.type?.includes('pdf');
            const ext = isPdf ? 'pdf' : 'jpg'; 
            sharedFileType = isPdf ? 'Document' : 'Photo';
            const filename = `batch_scan_${Date.now()}.${ext}`;
            const storageRef = ref(storage, `artifacts/${appId}/users/${user.uid}/uploads/${filename}`);
            await uploadBytes(storageRef, fileToUpload);
            sharedFileUrl = await getDownloadURL(storageRef);

            if (isPdf) {
                const thumbnailBlob = await generatePDFThumbnail(fileToUpload);
                if (thumbnailBlob) {
                     const thumbFilename = `batch_scan_thumb_${Date.now()}.jpg`;
                     const thumbRef = ref(storage, `artifacts/${appId}/users/${user.uid}/uploads/${thumbFilename}`);
                     await uploadBytes(thumbRef, thumbnailBlob);
                     sharedImageUrl = await getDownloadURL(thumbRef);
                }
            } else { sharedImageUrl = sharedFileUrl; }
        }
        
        const batch = writeBatch(db);
        const collectionRef = collection(db, 'artifacts', appId, 'users', user.uid, 'house_records');
        
        // ============ BULLETPROOF CONTRACTOR DATA RESOLUTION ============
        // Priority: 1. Explicit override  2. Item-level  3. newRecord  4. editingRecord  5. Empty
        const resolveContractor = () => {
            return contractorOverrides.contractor 
                || items[0]?.contractor 
                || newRecord?.contractor 
                || editingRecord?.contractor 
                || '';
        };
        
        const resolveContractorPhone = () => {
            return contractorOverrides.contractorPhone 
                || items[0]?.contractorPhone 
                || newRecord?.contractorPhone 
                || editingRecord?.contractorPhone 
                || '';
        };
        
        const resolveContractorEmail = () => {
            return contractorOverrides.contractorEmail 
                || items[0]?.contractorEmail 
                || newRecord?.contractorEmail 
                || editingRecord?.contractorEmail 
                || '';
        };
        
        const resolveContractorAddress = () => {
            return contractorOverrides.contractorAddress 
                || items[0]?.contractorAddress 
                || newRecord?.contractorAddress 
                || editingRecord?.contractorAddress 
                || '';
        };
        
        const resolveWarranty = () => {
            return contractorOverrides.warranty 
                || items[0]?.warranty 
                || newRecord?.warranty 
                || editingRecord?.warranty 
                || '';
        };
        
        // Pre-resolve once (not per item) for consistency
        const sharedContractor = resolveContractor();
        const sharedContractorPhone = resolveContractorPhone();
        const sharedContractorEmail = resolveContractorEmail();
        const sharedContractorAddress = resolveContractorAddress();
        const sharedWarranty = resolveWarranty();
        
        // ============ DEBUG LOG ============
        console.log('📋 BATCH SAVE - Contractor Resolution:', {
            contractor: sharedContractor,
            phone: sharedContractorPhone,
            email: sharedContractorEmail,
            address: sharedContractorAddress,
            sources: { 
                override: contractorOverrides, 
                firstItem: items[0], 
                newRecord, 
                editingRecord 
            }
        });
        // ===================================
        
        items.forEach((item) => {
             const newDocRef = doc(collectionRef);
             const dateInstalled = item.dateInstalled || newRecord?.dateInstalled || editingRecord?.dateInstalled || new Date().toISOString().split('T')[0];
             const nextDate = calculateNextDate(dateInstalled, item.maintenanceFrequency || 'none');
             
             const docData = { 
                 userId: user.uid, 
                 propertyId: activeProperty.id, 
                 propertyLocation: activeProperty.name, 
                 category: item.category || 'Other', 
                 item: item.item || 'Unknown Item', 
                 brand: item.brand || '', 
                 model: item.model || '', 
                 serialNumber: item.serial || item.serialNumber || '', 
                 cost: parseCost(item.cost), 
                 area: item.area || 'General', 
                 notes: item.notes || '', 
                 
                 dateInstalled: dateInstalled, 
                 maintenanceFrequency: item.maintenanceFrequency || 'none', 
                 nextServiceDate: nextDate, 
                 maintenanceTasks: item.maintenanceTasks || [], 
                 
                 // ============ BULLETPROOF CONTRACTOR FIELDS ============
                 contractor: sharedContractor,
                 contractorPhone: sharedContractorPhone,
                 contractorEmail: sharedContractorEmail,
                 contractorAddress: sharedContractorAddress,
                 warranty: sharedWarranty,
                 // =======================================================

                 imageUrl: sharedImageUrl || '', 
                 attachments: sharedFileUrl ? [{ name: 'Scan', type: sharedFileType, url: sharedFileUrl }] : [],
                 timestamp: serverTimestamp() 
             };
             batch.set(newDocRef, docData);
        });
        
        await batch.commit();
        toast.success(`${items.length} items saved!`);
        onSuccess();
    } catch (error) { 
        console.error("Batch Save Error:", error); 
        toast.error(`Error: ${error.code || error.message}`); 
    } finally { 
        setSaving(false); 
    }
};

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            const finalAtts = [];
            let coverUrl = '';
            for (const att of (newRecord.attachments || [])) {
                if (att.fileRef) {
                    const timestamp = Date.now();
                    const fileRef = ref(storage, `artifacts/${appId}/users/${user.uid}/uploads/${timestamp}_${att.name}`);
                    await uploadBytes(fileRef, att.fileRef);
                    const mainUrl = await getDownloadURL(fileRef);
                    let thumbnailUrl = null;
                    if (att.thumbnailRef) {
                            const thumbRef = ref(storage, `artifacts/${appId}/users/${user.uid}/uploads/${timestamp}_thumb_${att.name}.jpg`);
                            await uploadBytes(thumbRef, att.thumbnailRef);
                            thumbnailUrl = await getDownloadURL(thumbRef);
                            if (!coverUrl) coverUrl = thumbnailUrl;
                    } else if (att.type === 'Photo' && !coverUrl) { coverUrl = mainUrl; }
                    finalAtts.push({ name: att.name, size: att.size, type: att.type, url: mainUrl, dateAdded: new Date().toISOString() });
                } else if (att.url) {
                    finalAtts.push(att);
                    if (att.type === 'Photo' && !coverUrl && !att.url.startsWith('blob:')) coverUrl = att.url;
                }
            }
            
            const { originalRequestId, id, isBatch, ...data } = newRecord;
            data.cost = parseCost(data.cost);
            const payload = { ...data, attachments: finalAtts, imageUrl: coverUrl || '', userId: user.uid, propertyLocation: activeProperty.name, propertyId: activeProperty.id, nextServiceDate: calculateNextDate(data.dateInstalled, data.maintenanceFrequency) };
            
            if (editingRecord?.id) { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'house_records', editingRecord.id), payload); toast.success("Record updated!"); } 
            else { 
                await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'house_records'), { ...payload, timestamp: serverTimestamp() }); 
                setNewRecord(initial); 
                if (originalRequestId) try { await updateDoc(doc(db, REQUESTS_COLLECTION_PATH, originalRequestId), { status: 'archived' }); } catch(e){} 
            }
            onSuccess();
        } catch (e) { console.error(e); toast.error(`Save failed. Error: ${e.code || e.message}`); } finally { setSaving(false); }
    };

    return <AddRecordForm onSave={handleSave} onBatchSave={handleBatchSave} isSaving={saving} newRecord={newRecord} onInputChange={handleChange} onAttachmentsChange={handleAttachmentsChange} isEditing={!!editingRecord} onCancelEdit={onClose} existingRecords={existingRecords} />;
};
