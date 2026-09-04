"use client";

import { useEffect, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import { Motorcycle } from "@phosphor-icons/react";
import "mapbox-gl/dist/mapbox-gl.css";
import { C } from "@/components/ui/mobile/mobile-design-tokens";

const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

/**
 * The driver reports GPS every 12s and this page polls every 10s, so a marker
 * snapped straight to each fix would teleport and then freeze. Walking to each
 * new fix over roughly that same gap keeps the bike in near-constant motion,
 * which is what makes it read as a rider rather than a blinking pin.
 */
const GLIDE_MS = 9000;

type LatLng = { lat: number; lng: number };

function bearingBetween(from: LatLng, to: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function LiveDeliveryMap({
  token,
  customerLat,
  customerLng,
  driverLat,
  driverLng,
  height,
}: {
  token: string;
  customerLat: number;
  customerLng: number;
  driverLat: number | null;
  driverLng: number | null;
  height: number;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [shown, setShown] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState(0);
  const frame = useRef(0);
  const shownRef = useRef<LatLng | null>(null);

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    if (driverLat == null || driverLng == null) return;
    const to = { lat: driverLat, lng: driverLng };
    const from = shownRef.current;
    if (!from) {
      // First fix has nowhere to glide from, so drop the bike straight onto it.
      frame.current = requestAnimationFrame(() => setShown(to));
      return () => cancelAnimationFrame(frame.current);
    }
    if (from.lat === to.lat && from.lng === to.lng) return;

    const start = performance.now();
    let first = true;
    const step = (now: number) => {
      if (first) {
        first = false;
        setHeading(bearingBetween(from, to));
      }
      // Linear: a bike covering ground at a steady speed, not one that sprints
      // and then crawls into place.
      const t = Math.min(1, (now - start) / GLIDE_MS);
      setShown({
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
      });
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [driverLat, driverLng]);

  // Recentre on each real fix, not on each animated frame — refitting at 60fps
  // would leave the camera permanently mid-ease and the map feeling drunk.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (driverLat == null || driverLng == null) {
      map.easeTo({ center: [customerLng, customerLat], zoom: 14, duration: 600 });
      return;
    }
    map.fitBounds(
      [
        [Math.min(driverLng, customerLng), Math.min(driverLat, customerLat)],
        [Math.max(driverLng, customerLng), Math.max(driverLat, customerLat)],
      ],
      { padding: 64, maxZoom: 15.5, duration: 1200 },
    );
  }, [driverLat, driverLng, customerLat, customerLng]);

  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle={MAP_STYLE}
        initialViewState={{ longitude: customerLng, latitude: customerLat, zoom: 14 }}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        dragRotate={false}
        pitchWithRotate={false}
        touchZoomRotate={false}
      >
        <Marker longitude={customerLng} latitude={customerLat} anchor="bottom">
          <span
            style={{
              display: "flex",
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: C.red,
              border: "3px solid #fff",
              boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
            }}
            aria-hidden
          />
        </Marker>

        {shown ? (
          <Marker longitude={shown.lng} latitude={shown.lat} anchor="center">
            <span
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "rgba(189,35,32,0.18)",
                  animation: "vkBikePulse 1.8s ease-out infinite",
                }}
              />
              <span
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "#1A1A1A",
                  border: "2.5px solid #fff",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
                  // The icon draws a bike facing right, so heading west just
                  // mirrors it. Rotating a full 360° would ride it upside down.
                  transform: heading > 180 ? "scaleX(-1)" : "none",
                  transition: "transform 0.5s ease",
                }}
              >
                <Motorcycle size={19} weight="fill" color="#fff" />
              </span>
            </span>
          </Marker>
        ) : null}
      </Map>
      <style>{`
        @keyframes vkBikePulse {
          0% { transform: scale(0.55); opacity: 0.85; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
