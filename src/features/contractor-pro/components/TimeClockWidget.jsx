// src/features/contractor-pro/components/TimeClockWidget.jsx
// ============================================
// TIME CLOCK WIDGET WITH LOCATION VALIDATION
// ============================================
// Quick Win #5: Clock-in location validation and safety guardrails

import React, { useState, useEffect } from 'react';
import {
    Clock, MapPin, Play, Square, AlertTriangle, Check,
    Navigation, Car, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================
// LOCATION VALIDATION HELPERS
// ============================================

/**
 * Get current GPS position
 */
const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            (error) => reject(error),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
};

/**
 * Calculate distance between two points (Haversine formula)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Check if user is moving (based on speed from GPS)
 */
const isUserMoving = (position) => {
    // Speed in meters/second, threshold is ~5 mph (2.2 m/s)
    const speedThreshold = 2.2;
    return position.coords.speed !== null && position.coords.speed > speedThreshold;
};

// ============================================
// MAIN COMPONENT
// ============================================
export const TimeClockWidget = ({
    techId,
    techName,
    currentJob = null,
    onClockIn,
    onClockOut,
    clockedIn = false,
    clockInTime = null,
    // Safety settings
    requireLocationForClockIn = true,
    maxClockInDistance = 0.5, // miles from job site
    blockClockInWhileMoving = true,
    enforceRestPeriod = true,
    minRestHours = 10,
    lastClockOut = null
}) => {
    const [loading, setLoading] = useState(false);
    const [locationStatus, setLocationStatus] = useState('idle'); // idle, checking, valid, invalid, error
    const [locationError, setLocationError] = useState(null);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [distanceToJob, setDistanceToJob] = useState(null);
    const [isMoving, setIsMoving] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(null);

    // Update elapsed time when clocked in
    useEffect(() => {
        if (!clockedIn || !clockInTime) {
            setElapsedTime(null);
            return;
        }

        const updateElapsed = () => {
            const start = new Date(clockInTime);
            const now = new Date();
            const diff = now - start;

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setElapsedTime({ hours, minutes, seconds, total: diff });
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);

        return () => clearInterval(interval);
    }, [clockedIn, clockInTime]);

    // Validate location for clock-in
    const validateLocation = async () => {
        setLocationStatus('checking');
        setLocationError(null);

        try {
            const position = await getCurrentPosition();
            const { latitude, longitude, speed } = position.coords;

            setCurrentLocation({ lat: latitude, lng: longitude });

            // Check if moving
            const moving = isUserMoving(position);
            setIsMoving(moving);

            if (blockClockInWhileMoving && moving) {
                setLocationStatus('invalid');
                setLocationError('Cannot clock in while vehicle is in motion');
                return false;
            }

            // Check distance to job site (if job has location)
            if (currentJob?.serviceLocation && requireLocationForClockIn) {
                const distance = calculateDistance(
                    latitude, longitude,
                    currentJob.serviceLocation.lat,
                    currentJob.serviceLocation.lng
                );

                setDistanceToJob(distance);

                if (distance > maxClockInDistance) {
                    setLocationStatus('invalid');
                    setLocationError(`Too far from job site (${distance.toFixed(2)} miles away)`);
                    return false;
                }
            }

            setLocationStatus('valid');
            return true;

        } catch (error) {
            console.error('Location error:', error);
            setLocationStatus('error');

            if (error.code === 1) {
                setLocationError('Location permission denied');
            } else if (error.code === 2) {
                setLocationError('Location unavailable');
            } else if (error.code === 3) {
                setLocationError('Location request timed out');
            } else {
                setLocationError('Could not get location');
            }

            return false;
        }
    };

    // Check rest period compliance
    const checkRestPeriod = () => {
        if (!enforceRestPeriod || !lastClockOut) {
            return { compliant: true, hoursRemaining: 0 };
        }

        const lastOut = new Date(lastClockOut);
        const now = new Date();
        const hoursSinceLastShift = (now - lastOut) / (1000 * 60 * 60);

        if (hoursSinceLastShift < minRestHours) {
            return {
                compliant: false,
                hoursRemaining: minRestHours - hoursSinceLastShift
            };
        }

        return { compliant: true, hoursRemaining: 0 };
    };

    // Handle clock in
    const handleClockIn = async () => {
        setLoading(true);

        try {
            // Check rest period
            const restCheck = checkRestPeriod();
            if (!restCheck.compliant) {
                toast.error(`Rest period: ${restCheck.hoursRemaining.toFixed(1)} hours remaining`);
                setLoading(false);
                return;
            }

            // Validate location
            if (requireLocationForClockIn) {
                const locationValid = await validateLocation();
                if (!locationValid) {
                    toast.error(locationError || 'Location validation failed');
                    setLoading(false);
                    return;
                }
            }

            // Proceed with clock in
            await onClockIn({
                techId,
                location: currentLocation,
                timestamp: new Date().toISOString(),
                jobId: currentJob?.id
            });

            toast.success('Clocked in successfully');

        } catch (error) {
            console.error('Clock in error:', error);
            toast.error('Failed to clock in');
        } finally {
            setLoading(false);
        }
    };

    // Handle clock out
    const handleClockOut = async () => {
        setLoading(true);

        try {
            // Get current location for clock out record
            let location = null;
            try {
                const position = await getCurrentPosition();
                location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
            } catch (e) {
                // Location is optional for clock out
                console.warn('Could not get location for clock out:', e);
            }

            await onClockOut({
                techId,
                location,
                timestamp: new Date().toISOString(),
                totalMinutes: elapsedTime ? Math.round(elapsedTime.total / 60000) : 0
            });

            toast.success('Clocked out successfully');

        } catch (error) {
            console.error('Clock out error:', error);
            toast.error('Failed to clock out');
        } finally {
            setLoading(false);
        }
    };

    // Format elapsed time
    const formatElapsed = () => {
        if (!elapsedTime) return '00:00:00';
        const { hours, minutes, seconds } = elapsedTime;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${clockedIn ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                            <Clock size={20} className={clockedIn ? 'text-emerald-600' : 'text-slate-400'} />
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">Time Clock</p>
                            <p className="text-sm text-slate-500">{techName}</p>
                        </div>
                    </div>
                    {clockedIn && (
                        <div className="text-right">
                            <p className="text-2xl font-mono font-bold text-emerald-600">
                                {formatElapsed()}
                            </p>
                            <p className="text-xs text-slate-500">Elapsed</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Current Job */}
            {currentJob && (
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Current Job</p>
                    <p className="font-medium text-slate-800">{currentJob.title || currentJob.jobNumber}</p>
                    {currentJob.serviceAddress && (
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                            <MapPin size={12} />
                            {currentJob.serviceAddress}
                        </p>
                    )}
                </div>
            )}

            {/* Location Status */}
            {requireLocationForClockIn && !clockedIn && (
                <div className="p-4 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {locationStatus === 'checking' && (
                                <>
                                    <Loader2 size={16} className="text-blue-500 animate-spin" />
                                    <span className="text-sm text-blue-600">Checking location...</span>
                                </>
                            )}
                            {locationStatus === 'valid' && (
                                <>
                                    <Check size={16} className="text-emerald-500" />
                                    <span className="text-sm text-emerald-600">Location verified</span>
                                </>
                            )}
                            {locationStatus === 'invalid' && (
                                <>
                                    <AlertTriangle size={16} className="text-orange-500" />
                                    <span className="text-sm text-orange-600">{locationError}</span>
                                </>
                            )}
                            {locationStatus === 'error' && (
                                <>
                                    <AlertTriangle size={16} className="text-red-500" />
                                    <span className="text-sm text-red-600">{locationError}</span>
                                </>
                            )}
                            {locationStatus === 'idle' && (
                                <>
                                    <Navigation size={16} className="text-slate-400" />
                                    <span className="text-sm text-slate-500">Location required</span>
                                </>
                            )}
                        </div>

                        {distanceToJob !== null && (
                            <span className="text-xs text-slate-500">
                                {distanceToJob.toFixed(2)} mi from site
                            </span>
                        )}
                    </div>

                    {/* Moving warning */}
                    {isMoving && blockClockInWhileMoving && (
                        <div className="mt-2 p-2 bg-red-50 rounded-lg flex items-center gap-2">
                            <Car size={16} className="text-red-500" />
                            <span className="text-sm text-red-600">
                                Vehicle in motion - please stop before clocking in
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Clock In/Out Button */}
            <div className="p-4">
                {!clockedIn ? (
                    <button
                        onClick={handleClockIn}
                        disabled={loading || (requireLocationForClockIn && locationStatus === 'invalid')}
                        className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Play size={20} />
                        )}
                        Clock In
                    </button>
                ) : (
                    <button
                        onClick={handleClockOut}
                        disabled={loading}
                        className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Square size={20} />
                        )}
                        Clock Out
                    </button>
                )}
            </div>

            {/* Safety Notice */}
            <div className="px-4 pb-4">
                <p className="text-xs text-slate-400 text-center">
                    {blockClockInWhileMoving && 'Clock-in blocked while driving. '}
                    {enforceRestPeriod && `${minRestHours}h rest period enforced.`}
                </p>
            </div>
        </div>
    );
};

export default TimeClockWidget;
