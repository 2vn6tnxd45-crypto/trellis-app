// src/features/contractor-pro/hooks/useVehicles.js
// ============================================
// VEHICLES HOOK
// ============================================
// React hook for vehicle fleet management

import { useState, useEffect, useCallback } from 'react';
import {
    subscribeToVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    getAvailableVehicles,
    findBestVehicleForJob,
    assignVehicleToJob,
    unassignVehicleFromJob,
    checkMaintenanceNeeded
} from '../lib/vehicleService';
import toast from 'react-hot-toast';

/**
 * Hook for managing contractor vehicles
 * @param {string} contractorId - The contractor's ID
 * @returns {Object} Vehicle management utilities
 */
export const useVehicles = (contractorId) => {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Subscribe to real-time vehicle updates
    useEffect(() => {
        if (!contractorId) {
            setVehicles([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const unsubscribe = subscribeToVehicles(contractorId, (updatedVehicles) => {
            setVehicles(updatedVehicles);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [contractorId]);

    // Create a new vehicle
    const addVehicle = useCallback(async (vehicleData) => {
        if (!contractorId) {
            toast.error('Not authenticated');
            return null;
        }

        try {
            const newVehicle = await createVehicle(contractorId, vehicleData);
            toast.success(`${newVehicle.name} added to fleet`);
            return newVehicle;
        } catch (err) {
            console.error('Error creating vehicle:', err);
            toast.error(err.message || 'Failed to add vehicle');
            throw err;
        }
    }, [contractorId]);

    // Update a vehicle
    const editVehicle = useCallback(async (vehicleId, updates) => {
        if (!contractorId) {
            toast.error('Not authenticated');
            return;
        }

        try {
            await updateVehicle(contractorId, vehicleId, updates);
            toast.success('Vehicle updated');
        } catch (err) {
            console.error('Error updating vehicle:', err);
            toast.error(err.message || 'Failed to update vehicle');
            throw err;
        }
    }, [contractorId]);

    // Delete a vehicle
    const removeVehicle = useCallback(async (vehicleId) => {
        if (!contractorId) {
            toast.error('Not authenticated');
            return;
        }

        try {
            await deleteVehicle(contractorId, vehicleId);
            toast.success('Vehicle removed from fleet');
        } catch (err) {
            console.error('Error deleting vehicle:', err);
            toast.error(err.message || 'Failed to remove vehicle');
            throw err;
        }
    }, [contractorId]);

    // Get available vehicles for a date
    const getAvailable = useCallback((date, scheduledJobs = []) => {
        return getAvailableVehicles(vehicles, date, scheduledJobs);
    }, [vehicles]);

    // Find best vehicle for a job
    const suggestVehicle = useCallback((requiredEquipment = [], preferredTechId = null, date = new Date(), scheduledJobs = []) => {
        const available = getAvailableVehicles(vehicles, date, scheduledJobs);
        return findBestVehicleForJob(available, requiredEquipment, preferredTechId);
    }, [vehicles]);

    // Assign vehicle to job
    const assignToJob = useCallback(async (jobId, vehicleId) => {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (!vehicle) {
            toast.error('Vehicle not found');
            return;
        }

        try {
            await assignVehicleToJob(jobId, vehicleId, vehicle.name);
            toast.success(`${vehicle.name} assigned to job`);
        } catch (err) {
            console.error('Error assigning vehicle:', err);
            toast.error('Failed to assign vehicle');
            throw err;
        }
    }, [vehicles]);

    // Unassign vehicle from job
    const unassignFromJob = useCallback(async (jobId) => {
        try {
            await unassignVehicleFromJob(jobId);
            toast.success('Vehicle unassigned');
        } catch (err) {
            console.error('Error unassigning vehicle:', err);
            toast.error('Failed to unassign vehicle');
            throw err;
        }
    }, []);

    // Check maintenance status for all vehicles
    const getMaintenanceAlerts = useCallback(() => {
        return vehicles
            .map(vehicle => ({
                vehicle,
                ...checkMaintenanceNeeded(vehicle)
            }))
            .filter(alert => alert.needed || alert.urgency !== 'none');
    }, [vehicles]);

    // Get vehicle by ID
    const getVehicleById = useCallback((vehicleId) => {
        return vehicles.find(v => v.id === vehicleId) || null;
    }, [vehicles]);

    // Statistics
    const stats = {
        total: vehicles.length,
        available: vehicles.filter(v => v.status === 'available').length,
        inUse: vehicles.filter(v => v.status === 'in_use').length,
        maintenance: vehicles.filter(v => v.status === 'maintenance').length,
        retired: vehicles.filter(v => v.status === 'retired').length
    };

    return {
        // State
        vehicles,
        loading,
        error,
        stats,

        // CRUD operations
        addVehicle,
        editVehicle,
        removeVehicle,

        // Queries
        getVehicleById,
        getAvailable,
        suggestVehicle,
        getMaintenanceAlerts,

        // Job assignment
        assignToJob,
        unassignFromJob
    };
};

export default useVehicles;
