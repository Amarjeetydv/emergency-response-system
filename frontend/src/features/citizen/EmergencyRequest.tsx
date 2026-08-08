import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { emergencyApi } from '../../services/api/emergencyApi';

interface EmergencyRequestProps {
  embedMode?: boolean;
  onSubmitted?: (report: any) => void;
}

export const EmergencyRequest: React.FC<EmergencyRequestProps> = ({
  embedMode = false,
  onSubmitted,
}) => {
  const [emergencyType, setEmergencyType] = useState('police');
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [description, setDescription] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [locationState, setLocationState] = useState<'detecting' | 'detected' | 'failed'>('detecting');

  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();

  // Load global Leaflet L
  const L = (window as any).L;

  // Map Initialization
  useEffect(() => {
    if (!L) {
      console.error('Leaflet is not loaded on window.');
      return;
    }

    try {
      // Default center: India [20.5937, 78.9629]
      const mapInstance = L.map('map').setView([20.5937, 78.9629], 5);
      mapRef.current = mapInstance;

      // Add Free Satellite Imagery (Esri World Imagery)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution:
            'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        }
      ).addTo(mapInstance);

      // Auto-detect location on load
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setLatitude(lat);
            setLongitude(lng);
            updateMarker(mapInstance, lat, lng, true, 'You are here');
            setLocationState('detected');
          },
          () => {
            // Default to New Delhi if location blocked
            const lat = 28.6139;
            const lng = 77.209;
            setLatitude(lat);
            setLongitude(lng);
            updateMarker(mapInstance, lat, lng, true, 'Default Location');
            setLocationState('failed');
          }
        );
      } else {
        setLocationState('failed');
      }

      // Map Click Event
      mapInstance.on('click', (e: any) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        setLatitude(lat);
        setLongitude(lng);
        updateMarker(mapInstance, lat, lng, false);
      });

      // Fix sizing layout
      setTimeout(() => {
        mapInstance.invalidateSize();
      }, 500);
    } catch (err) {
      console.error('Leaflet map initialization failed', err);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const updateMarker = (
    mapObj: any,
    lat: number,
    lng: number,
    adjustZoom: boolean = true,
    popupText?: string
  ) => {
    if (!mapObj || !L) return;

    if (!markerRef.current) {
      const redIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const newMarker = L.marker([lat, lng], {
        draggable: true,
        icon: redIcon,
      }).addTo(mapObj);

      if (popupText) {
        newMarker.bindPopup(popupText).openPopup();
      }

      newMarker.on('dragend', (event: any) => {
        const pos = event.target.getLatLng();
        setLatitude(pos.lat);
        setLongitude(pos.lng);
      });

      markerRef.current = newMarker;
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }

    if (adjustZoom) {
      mapObj.setView([lat, lng], 16);
    } else {
      mapObj.panTo([lat, lng]);
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('File is too large. Maximum allowed size is 5MB.');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setFileType(file.type.startsWith('image') ? 'image' : 'video');
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage('');
  };

  const removeFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileType(null);
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('emergency_type', emergencyType);
    formData.append('latitude', String(latitude));
    formData.append('longitude', String(longitude));
    
    if (description) {
      formData.append('description', description);
    }
    if (selectedFile) {
      formData.append('media', selectedFile);
    }

    try {
      const response = await emergencyApi.createEmergency(formData);
      setIsSubmitting(false);
      setSuccessMessage('Emergency reported. Responders have been notified.');
      
      const responseData = response.data;
      const report = responseData?.data || responseData;

      if (onSubmitted) {
        onSubmitted(report);
      }

      if (!embedMode) {
        setTimeout(() => {
          navigate('/dashboard');
        }, 2500);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      console.error(err);
      setErrorMessage(
        err?.response?.data?.message || err?.message || 'Could not submit request.'
      );
    }
  };

  return (
    <div className="request-container glass-panel shadow-lg">
      <div className="header-urgent">
        <h2>🚨 Report Emergency</h2>
        <p>Your location will be sent to dispatchers immediately.</p>
      </div>

      <p className="instruction-text">
        Tap the map or drag the marker to your location
        <span className={`location-status-badge ms-2 ${locationState}`}>
          {locationState === 'detecting' && '⏳ Detecting location...'}
          {locationState === 'detected' && '📍 Location detected'}
          {locationState === 'failed' && '⚠️ Location sharing unavailable. Set manually.'}
        </span>
      </p>
      <div className="map-wrapper">
        <div id="map" className="mini-map"></div>
      </div>

      {latitude !== 0 && (
        <div className="location-info">
          <div className="coord-badge">
            <span className="label">LAT</span>
            <span className="value">{latitude.toFixed(6)}</span>
            <span className="label">LNG</span>
            <span className="value">{longitude.toFixed(6)}</span>
          </div>
        </div>
      )}

      <form onSubmit={submitRequest}>
        <div className="form-group">
          <label htmlFor="emergency-type-select">Nature of Emergency</label>
          <select
            id="emergency-type-select"
            value={emergencyType}
            onChange={(e) => setEmergencyType(e.target.value)}
            name="type"
            required
          >
            <option value="police">🚓 Police / Security</option>
            <option value="medical">🚑 Medical Emergency</option>
            <option value="fire">🚒 Fire / Rescue</option>
            <option value="other">❓ Other</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description-textarea">Detailed Description</label>
          <textarea
            id="description-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            name="description"
            placeholder="Describe the situation..."
            rows={3}
          ></textarea>
        </div>

        <div className="form-group">
          <label htmlFor="evidence-file-input">Photo/Video Evidence</label>
          <input
            id="evidence-file-input"
            type="file"
            onChange={onFileSelected}
            accept="image/*,video/*"
            className="d-none"
            ref={fileInputRef}
          />
          <button
            type="button"
            className="btn-outline mb-2"
            onClick={() => fileInputRef.current?.click()}
          >
            📸 Take Photo/Video or Choose File
          </button>

          {previewUrl && (
            <div className="preview-box">
              {fileType === 'image' && (
                <img src={previewUrl} alt="evidence preview" className="media-preview" />
              )}
              {fileType === 'video' && (
                <video src={previewUrl} controls className="media-preview" />
              )}
              <button type="button" className="btn-remove" onClick={removeFile}>
                ✕
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn-danger btn-block"
          disabled={latitude === 0 || isSubmitting}
        >
          {isSubmitting ? 'Dispatching Help...' : 'SEND EMERGENCY ALERT'}
        </button>
      </form>

      {successMessage && <div className="success-banner">{successMessage}</div>}
      {errorMessage && <div className="error-banner">{errorMessage}</div>}
    </div>
  );
};

export default EmergencyRequest;
