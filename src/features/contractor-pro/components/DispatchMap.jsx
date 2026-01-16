// src/features/contractor-pro/components/DispatchMap.jsx
// ============================================
// DISPATCH MAP
// ============================================
// Real-time map showing all technician locations

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    MapPin, Navigation, Wrench, User, Clock,
    RefreshCw, Maximize2, Minimize2, Filter,
    Phone, Eye, EyeOff, Truck, Home, AlertCircle
} from 'lucide-react';
import { STATUS_CONFIG, FIELD_STATUS } from '../lib/trackingService';
import { googleMapsApiKey } from '../../../config/constants';

// ============================================
// TECH INFO PANEL
// ============================================

const TechInfoPanel = ({ tech, location, currentJob, onClose, onCall }) => {
    if (!tech) return null;

    const lastUpdate = location?.timestamp?.toDate?.();
    const minutesAgo = lastUpdate ? Math.round((Date.now() - lastUpdate.getTime()) / 60000) : null;

    return (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-30">
            <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
            >
                ×
            </button>

            <div className="flex items-center gap-3 mb-3">
                <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: tech.color || '#64748B' }}
                >
                    {tech.name?.charAt(0)}
                </div>
                <div>
                    <p className="font-bold text-slate-800">{tech.name}</p>
                    <p className="text-sm text-slate-500">{tech.role || 'Technician'}</p>
                </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 mb-3">
                <span className={`
                    px-2 py-1 rounded-full text-xs font-medium
                    ${location?.status === 'en_route' ? 'bg-blue-100 text-blue-700' : ''}
                    ${location?.status === 'on_site' ? 'bg-amber-100 text-amber-700' : ''}
                    ${location?.status === 'idle' ? 'bg-slate-100 text-slate-600' : ''}
                `}>
                    {location?.status === 'en_route' ? 'En Route' :
                     location?.status === 'on_site' ? 'On Site' : 'Idle'}
                </span>
                {minutesAgo != null && (
                    <span className="text-xs text-slate-400">
                        Updated {minutesAgo === 0 ? 'just now' : `${minutesAgo}m ago`}
                    </span>
                )}
                {!location?.isOnline && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        Offline
                    </span>
                )}
            </div>

            {/* Current Job */}
            {currentJob && (
                <div className="bg-slate-50 rounded-lg p-2 mb-3">
                    <p className="text-xs text-slate-500">Current Job</p>
                    <p className="font-medium text-slate-800 truncate">
                        {currentJob.title || currentJob.serviceType}
                    </p>
                    <p className="text-sm text-slate-500 truncate">
                        {currentJob.customer?.name}
                    </p>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                {tech.phone && (
                    <button
                        onClick={() => onCall(tech.phone)}
                        className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                        <Phone size={16} />
                        Call
                    </button>
                )}
            </div>
        </div>
    );
};

// ============================================
// TECH LIST ITEM (Fallback view)
// ============================================

const TechListItem = ({ tech, location, onClick }) => {
    const isOnline = location?.isOnline;
    const lastUpdate = location?.timestamp?.toDate?.();
    const minutesAgo = lastUpdate ? Math.round((Date.now() - lastUpdate.getTime()) / 60000) : null;

    return (
        <button
            onClick={() => onClick(tech)}
            className="w-full bg-white rounded-lg p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
        >
            <div className="relative">
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: tech.color || '#64748B' }}
                >
                    {tech.name?.charAt(0)}
                </div>
                {/* Online indicator */}
                <span className={`
                    absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white
                    ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}
                `} />
            </div>

            <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{tech.name}</p>
                <p className="text-xs text-slate-500">
                    {location?.status === 'en_route' && '🚗 En Route'}
                    {location?.status === 'on_site' && '📍 On Site'}
                    {location?.status === 'idle' && '⏸️ Idle'}
                    {!location?.status && '❓ Unknown'}
                </p>
            </div>

            <div className="text-right">
                {minutesAgo != null && (
                    <p className="text-xs text-slate-400">
                        {minutesAgo === 0 ? 'now' : `${minutesAgo}m`}
                    </p>
                )}
                {!isOnline && (
                    <span className="text-xs text-red-500">Offline</span>
                )}
            </div>
        </button>
    );
};

// ============================================
// MAIN DISPATCH MAP COMPONENT
// ============================================

export const DispatchMap = ({
    techLocations = [],
    teamMembers = [],
    jobs = [],
    homeBase,
    onTechClick,
    onJobClick,
    className = ''
}) => {
    const mapRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [markers, setMarkers] = useState([]);
    const [selectedTech, setSelectedTech] = useState(null);
    const [showJobs, setShowJobs] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    // Merge tech data with locations
    const techsWithLocations = useMemo(() => {
        return teamMembers.map(tech => {
            const location = techLocations.find(loc => loc.techId === tech.id);
            return { tech, location };
        }).filter(t => t.location?.location);
    }, [teamMembers, techLocations]);

    // Jobs with coordinates
    const jobsWithCoords = useMemo(() => {
        return jobs.filter(job =>
            job.serviceAddress?.coordinates?.lat &&
            job.serviceAddress?.coordinates?.lng
        );
    }, [jobs]);

    // Initialize Google Map
    useEffect(() => {
        if (!googleMapsApiKey || !mapRef.current || mapInstance) return;

        const initMap = () => {
            try {
                const defaultCenter = homeBase?.coordinates || { lat: 34.0522, lng: -118.2437 };
                const map = new window.google.maps.Map(mapRef.current, {
                    zoom: 11,
                    center: defaultCenter,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    styles: [
                        { featureType: 'poi', stylers: [{ visibility: 'off' }] }
                    ]
                });
                setMapInstance(map);
                setMapLoaded(true);
            } catch (error) {
                console.error('Failed to init map:', error);
                setMapError('Failed to load map');
            }
        };

        // Load Google Maps script if not already loaded
        if (window.google?.maps) {
            initMap();
        } else {
            const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
            if (existingScript) {
                existingScript.addEventListener('load', initMap);
                return;
            }

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}`;
            script.async = true;
            script.onload = initMap;
            script.onerror = () => setMapError('Failed to load Google Maps');
            document.head.appendChild(script);
        }
    }, [googleMapsApiKey, homeBase, mapInstance]);

    // Update markers when data changes
    useEffect(() => {
        if (!mapInstance || !mapLoaded) return;

        // Clear existing markers
        markers.forEach(marker => marker.setMap(null));
        const newMarkers = [];

        // Add tech markers
        techsWithLocations.forEach(({ tech, location }) => {
            if (location?.location) {
                const statusColor = location.status === 'en_route' ? '#3B82F6' :
                                   location.status === 'on_site' ? '#F59E0B' : '#64748B';

                const marker = new window.google.maps.Marker({
                    position: { lat: location.location.lat, lng: location.location.lng },
                    map: mapInstance,
                    title: tech.name,
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 12,
                        fillColor: tech.color || statusColor,
                        fillOpacity: location.isOnline ? 1 : 0.5,
                        strokeColor: '#ffffff',
                        strokeWeight: 3
                    }
                });

                marker.addListener('click', () => {
                    setSelectedTech(tech);
                    onTechClick?.(tech);
                });

                newMarkers.push(marker);
            }
        });

        // Add job markers if enabled
        if (showJobs) {
            jobsWithCoords.forEach(job => {
                const statusColor = STATUS_CONFIG[job.fieldStatus]?.color || '#64748B';

                const marker = new window.google.maps.Marker({
                    position: job.serviceAddress.coordinates,
                    map: mapInstance,
                    title: job.title || job.serviceType,
                    icon: {
                        path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                        scale: 6,
                        fillColor: statusColor,
                        fillOpacity: 0.8,
                        strokeColor: '#ffffff',
                        strokeWeight: 2
                    }
                });

                marker.addListener('click', () => {
                    onJobClick?.(job);
                });

                newMarkers.push(marker);
            });
        }

        // Add home base marker
        if (homeBase?.coordinates) {
            const homeMarker = new window.google.maps.Marker({
                position: homeBase.coordinates,
                map: mapInstance,
                title: 'Home Base',
                icon: {
                    path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
                    fillColor: '#10B981',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 1,
                    scale: 1.5,
                    anchor: new window.google.maps.Point(12, 22)
                }
            });
            newMarkers.push(homeMarker);
        }

        setMarkers(newMarkers);

        // Fit bounds to show all markers
        if (newMarkers.length > 1) {
            const bounds = new window.google.maps.LatLngBounds();
            newMarkers.forEach(marker => {
                bounds.extend(marker.getPosition());
            });
            mapInstance.fitBounds(bounds, 50);
        }

        return () => {
            newMarkers.forEach(marker => marker.setMap(null));
        };
    }, [mapInstance, mapLoaded, techsWithLocations, jobsWithCoords, showJobs, homeBase]);

    // Handle tech selection
    const handleTechClick = (tech) => {
        setSelectedTech(selectedTech?.id === tech.id ? null : tech);
        onTechClick?.(tech);
    };

    // Get current job for selected tech
    const selectedTechJob = useMemo(() => {
        if (!selectedTech) return null;
        const location = techLocations.find(l => l.techId === selectedTech.id);
        if (!location?.currentJobId) return null;
        return jobs.find(j => j.id === location.currentJobId);
    }, [selectedTech, techLocations, jobs]);

    // Online count
    const onlineCount = techsWithLocations.filter(t => t.location?.isOnline).length;

    // Fallback if no API key
    if (!googleMapsApiKey) {
        return (
            <div className={`bg-slate-100 rounded-xl overflow-hidden ${className}`}>
                <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium text-slate-700">
                            {onlineCount} Online
                        </span>
                    </div>
                    <span className="text-xs text-slate-400">Map unavailable</span>
                </div>

                <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                    {techsWithLocations.length === 0 ? (
                        <div className="text-center py-8">
                            <MapPin size={32} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-slate-500">No tech locations available</p>
                        </div>
                    ) : (
                        techsWithLocations.map(({ tech, location }) => (
                            <TechListItem
                                key={tech.id}
                                tech={tech}
                                location={location}
                                onClick={handleTechClick}
                            />
                        ))
                    )}
                </div>

                {selectedTech && (
                    <TechInfoPanel
                        tech={selectedTech}
                        location={techLocations.find(l => l.techId === selectedTech.id)}
                        currentJob={selectedTechJob}
                        onClose={() => setSelectedTech(null)}
                        onCall={(phone) => window.open(`tel:${phone}`)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className={`relative bg-slate-100 rounded-xl overflow-hidden ${className} ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
            {/* Map Container */}
            <div ref={mapRef} className="w-full h-full min-h-[400px]" />

            {/* Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button
                    onClick={() => setShowJobs(!showJobs)}
                    className={`p-2 rounded-lg shadow-md transition-colors ${
                        showJobs ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'
                    }`}
                    title={showJobs ? 'Hide Jobs' : 'Show Jobs'}
                >
                    {showJobs ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
                <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 bg-white rounded-lg shadow-md text-slate-600 hover:bg-slate-50"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                    {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur rounded-lg p-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>En Route</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500" />
                    <span>On Site</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-slate-400" />
                    <span>Idle</span>
                </div>
            </div>

            {/* Online Count */}
            <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md px-3 py-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">
                    {onlineCount} Online
                </span>
            </div>

            {/* Selected Tech Panel */}
            {selectedTech && (
                <TechInfoPanel
                    tech={selectedTech}
                    location={techLocations.find(l => l.techId === selectedTech.id)}
                    currentJob={selectedTechJob}
                    onClose={() => setSelectedTech(null)}
                    onCall={(phone) => window.open(`tel:${phone}`)}
                />
            )}

            {/* Loading State */}
            {!mapLoaded && !mapError && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                    <div className="text-center">
                        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2" />
                        <p className="text-slate-500">Loading map...</p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {mapError && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                    <div className="text-center">
                        <AlertCircle size={48} className="mx-auto text-red-400 mb-2" />
                        <p className="text-slate-600">{mapError}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DispatchMap;
