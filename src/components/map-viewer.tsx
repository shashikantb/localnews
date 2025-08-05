

'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import { Briefcase, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { getPostsForMap, getBusinessesForMap, getFamilyLocations } from '@/app/actions';
import type { Post, BusinessUser, FamilyMemberLocation } from '@/lib/db-types';
import { useToast } from '@/hooks/use-toast';
import { differenceInHours, formatDistanceToNowStrict } from 'date-fns';
import { Button } from './ui/button';

declare module 'leaflet' {
    function heatLayer(latlngs: L.HeatLatLngTuple[], options?: any): any;
}

const HeatmapComponent = ({ items }: { items: (Post | BusinessUser)[] }) => {
    const map = useMap();
    const heatmapLayerRef = useRef<any | null>(null);
    const [isHeatmapReady, setIsHeatmapReady] = useState(false);

    useEffect(() => {
        if (isHeatmapReady) return;
        import('leaflet.heat').then(() => {
            setIsHeatmapReady(true);
        }).catch(err => console.error("Failed to load leaflet.heat", err));
    }, [isHeatmapReady]);

    useEffect(() => {
        if (!isHeatmapReady || !map) return;

        if (heatmapLayerRef.current) {
            map.removeLayer(heatmapLayerRef.current);
        }

        if (items.length > 0) {
            const points = items.map(p => [p.latitude, p.longitude, 1] as L.HeatLatLngTuple);
            heatmapLayerRef.current = L.heatLayer(points, { 
                radius: 20, 
                blur: 15,
                max: 1.0
            }).addTo(map);
        }
    }, [items, map, isHeatmapReady]);

    return null;
};

const MapEvents = ({ onMapChange }: { onMapChange: (map: LeafletMap) => void }) => {
    const map = useMapEvents({
        moveend: () => onMapChange(map),
        zoomend: () => onMapChange(map),
    });
    
    useEffect(() => {
        onMapChange(map);
    }, [map, onMapChange]);
    
    return null;
};

function debounce(func: (...args: any[]) => void, wait: number) {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export default function MapViewer() {
  const [position, setPosition] = useState<LatLngExpression | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [businesses, setBusinesses] = useState<BusinessUser[]>([]);
  const [familyLocations, setFamilyLocations] = useState<FamilyMemberLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });
  }, []);

  const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const businessIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const createFamilyIcon = (imageUrl: string | null | undefined) => {
    return L.divIcon({
        html: `
            <div style="background-image: url(${imageUrl || '/images/default-avatar.png'});" class="w-10 h-10 rounded-full bg-cover bg-center border-2 border-green-500 shadow-md">
            </div>
        `,
        className: 'bg-transparent border-0',
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40]
    });
  };

  const getPulseClassName = (postDate: string): string => {
    const hours = differenceInHours(new Date(), new Date(postDate));
    if (hours < 1) return 'pulse-fast';
    if (hours < 6) return 'pulse-medium';
    return 'pulse-slow';
  };

  const fetchMapData = useCallback(async (map: LeafletMap) => {
    setIsLoading(true);
    try {
      const bounds = map.getBounds();
      const mapBounds = {
        ne: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
        sw: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
      };
      const [fetchedPosts, fetchedBusinesses, fetchedFamily] = await Promise.all([
        getPostsForMap(mapBounds),
        getBusinessesForMap(mapBounds),
        getFamilyLocations() // Fetches locations for the logged-in user
      ]);
      setPosts(fetchedPosts);
      setBusinesses(fetchedBusinesses);
      setFamilyLocations(fetchedFamily);
    } catch (err) {
      console.error("Failed to fetch map data", err);
      toast({
        variant: "destructive",
        title: "Could not load data",
        description: "There was an error fetching data for the map.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.error(err);
        setError('Could not get your location. Please enable location services and refresh.');
        setPosition([20.5937, 78.9629]);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const debouncedFetch = useCallback(debounce(fetchMapData, 500), [fetchMapData]);

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  if (!position) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Finding your location to load map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
         <div className="absolute top-4 right-4 z-[1000] bg-background/80 p-2 rounded-md shadow-lg flex items-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm font-medium">Loading Data...</span>
         </div>
      )}
      <MapContainer
        center={position}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapEvents onMapChange={debouncedFetch} />

        <HeatmapComponent items={[...posts, ...businesses]} />
        
        <Marker position={position} icon={userIcon}>
          <Popup>You are here.</Popup>
        </Marker>
        
        {posts.map(post => {
            if (!post || !post.latitude || !post.longitude) return null;
            const pulseClassName = getPulseClassName(post.createdat);
            const postIcon = new L.DivIcon({
              html: `<div class="pulsing-dot ${pulseClassName}"></div>`,
              className: 'bg-transparent border-0',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });

            return (
                <Marker key={`post-${post.id}`} position={[post.latitude, post.longitude]} icon={postIcon}>
                  <Popup>
                      <div className="w-48">
                          <p className="font-semibold text-base mb-1 truncate">{post.content || "Media Post"}</p>
                          <p className="text-xs text-muted-foreground mb-2">By: {post.authorname || 'Anonymous'}</p>
                          <Button asChild size="sm" className="w-full">
                              <Link href={`/posts/${post.id}`}>View Pulse</Link>
                          </Button>
                      </div>
                  </Popup>
                </Marker>
            );
        })}

        {businesses.map(business => {
            if (!business || !business.latitude || !business.longitude) return null;
            return (
                <Marker key={`business-${business.id}`} position={[business.latitude, business.longitude]} icon={businessIcon}>
                    <Popup>
                        <div className="w-48">
                            <p className="font-semibold text-base mb-1 truncate">{business.name}</p>
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                                <Briefcase className="w-3 h-3" />
                                {business.business_category}
                            </p>
                            <Button asChild size="sm" className="w-full">
                                <Link href={`/users/${business.id}`}>View Profile</Link>
                            </Button>
                        </div>
                    </Popup>
                </Marker>
            )
        })}

        {familyLocations.map(member => {
            if (!member || !member.latitude || !member.longitude) return null;
            return (
                <Marker key={`family-${member.id}`} position={[member.latitude, member.longitude]} icon={createFamilyIcon(member.profilepictureurl)}>
                    <Popup>
                        <div className="w-48">
                            <p className="font-semibold text-base mb-1 truncate flex items-center gap-2 text-green-700"><Users className="w-4 h-4" />{member.name}</p>
                            <p className="text-xs text-muted-foreground mb-2">Last updated: {formatDistanceToNowStrict(new Date(member.last_updated), { addSuffix: true })}</p>
                            <Button asChild size="sm" className="w-full">
                                <Link href={`/users/${member.id}`}>View Profile</Link>
                            </Button>
                        </div>
                    </Popup>
                </Marker>
            )
        })}
      </MapContainer>
    </div>
  );
}

