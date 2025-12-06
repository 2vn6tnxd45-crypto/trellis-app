// src/features/requests/ContractorView.jsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CheckCircle, AlertTriangle, User, Tag, Box, Calendar, Clock, ChevronDown, UploadCloud, Send, Briefcase, History, BadgeCheck, Mail, Save, MapPin, Wrench } from 'lucide-react';
import { db, auth, storage } from '../../config/firebase';
import { REQUESTS_COLLECTION_PATH, CATEGORIES, MAINTENANCE_FREQUENCIES } from '../../config/constants';
import { compressImage } from '../../lib/images';
import { calculateNextDate } from '../../lib/utils';
import { Logo } from '../../components/common/Logo';

export const ContractorView = () => {
    const [requestData, setRequestData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('form');
    const [history, setHistory] = useState([]);
    const [formData, setFormData] = useState({ category: '', item: '', brand: '', model: '', notes: '', contractor: '', email: '', maintenanceFrequency: 'none', dateInstalled: new Date().toISOString().split('T')[0] });
    const [selectedFile, setSelectedFile] = useState(null);
    const [rememberMe, setRememberMe] = useState(true);

    useEffect(() => {
        const init = async () => {
            const savedContractor = JSON.parse(localStorage.getItem('krib_contractor') || '{}');
            if (savedContractor.name) {
                setFormData(prev => ({ ...prev, contractor: savedContractor.name, email: savedContractor.email || '' }));
            }
            const params = new URLSearchParams(window.location.search);
            const requestId = params.get('requestId');
            if (!requestId) { setError("Invalid request link."); setLoading(false); return; }
            try {
                if (!auth.currentUser) await signInAnonymously(auth);
                const docSnap = await getDoc(doc(db, REQUESTS_COLLECTION_PATH, requestId));
                if (docSnap.exists() && docSnap.data().status === 'pending') {
                    setRequestData({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setError("Request expired or not found.");
                }
            } catch (e) { setError("Connection failed."); } finally { setLoading(false); }
        };
        init();
    }, []);

    const handleFetchHistory = async () => {
        if (!formData.email || !requestData?.createdBy) return;
        setLoading
