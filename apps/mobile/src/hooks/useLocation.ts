import { useState, useEffect } from 'react'
import * as Location from 'expo-location'

export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number | null
  address?: string
}

export interface LocationState {
  location: LocationData | null
  isLoading: boolean
  error: string | null
  permissionGranted: boolean
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    location: null,
    isLoading: false,
    error: null,
    permissionGranted: false,
  })

  // Check permission status on mount
  useEffect(() => {
    checkPermission()
  }, [])

  async function checkPermission() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync()
      setState(prev => ({ ...prev, permissionGranted: status === 'granted' }))
    } catch (error) {
      console.error('Failed to check location permission:', error)
    }
  }

  async function requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      const granted = status === 'granted'
      setState(prev => ({ ...prev, permissionGranted: granted }))
      return granted
    } catch (error) {
      console.error('Failed to request location permission:', error)
      setState(prev => ({ ...prev, error: 'Permission request failed' }))
      return false
    }
  }

  async function getCurrentLocation(): Promise<LocationData | null> {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Check/request permission first
      if (!state.permissionGranted) {
        const granted = await requestPermission()
        if (!granted) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Location permission denied',
          }))
          return null
        }
      }

      // Get current position with high accuracy
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 10000, // 10 second timeout
      })

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }

      // Optional: Reverse geocode to get address (best-effort)
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        })

        if (addresses && addresses.length > 0) {
          const addr = addresses[0]
          // Build address with more precision: street/district, city, country
          const addressParts = [
            addr.street || addr.district || addr.name,
            addr.city,
            addr.country,
          ]
            .filter(Boolean)
          
          locationData.address = addressParts.join(', ')
        }
      } catch (geocodeError) {
        // Geocoding is optional, don't fail if it doesn't work
        console.log('Geocoding failed (non-critical):', geocodeError)
      }

      setState(prev => ({
        ...prev,
        location: locationData,
        isLoading: false,
        error: null,
      }))

      return locationData
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to get location'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        location: null,
      }))
      return null
    }
  }

  function clearLocation() {
    setState(prev => ({ ...prev, location: null, error: null }))
  }

  return {
    ...state,
    requestPermission,
    getCurrentLocation,
    clearLocation,
  }
}
