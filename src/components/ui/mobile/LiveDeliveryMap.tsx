"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { C } from "@/components/ui/mobile/mobile-design-tokens";
import { haversineMeters } from "@/lib/geo";

const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

/**
 * The driver reports GPS every 12s and this page polls every 10s, so a marker
 * snapped straight to each fix would teleport and then freeze. Walking to each
 * new fix over roughly that same gap keeps the bike in near-constant motion,
 * which is what makes it read as a rider rather than a blinking pin.
 */
const GLIDE_MS = 9000;
/** Re-ask Directions only after the driver has actually covered ground. */
const ROUTE_REFRESH_M = 120;
/** ...or after this long, so traffic-driven ETA changes still land. */
const ROUTE_MAX_AGE_MS = 45_000;

type LatLng = { lat: number; lng: number };
type Route = { coords: [number, number][]; distanceM: number; durationS: number };

/** The scooter art already faces north, so bearing 0° is rotate(0). */
const FACING_OFFSET_DEG = 0;

/** Shortest turn, kept unwrapped so CSS doesn't spin the long way around. */
function nextRotation(current: number | null, bearing: number): number {
  const target = bearing + FACING_OFFSET_DEG;
  if (current == null) return target;
  const delta = ((target - current + 540) % 360) - 180;
  return current + delta;
}

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
  /** True when the last GPS fix is old enough that the bike is a memory, not a live position. */
  driverStale = false,
  height,
  onEta,
}: {
  token: string;
  customerLat: number;
  customerLng: number;
  driverLat: number | null;
  driverLng: number | null;
  driverStale?: boolean;
  height: number;
  /** Live road time, so the card under the map can show it without covering the route. */
  onEta?: (eta: { minutes: number; metres: number } | null) => void;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [shown, setShown] = useState<LatLng | null>(null);
  const [rotation, setRotation] = useState(0);
  const [turnReady, setTurnReady] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const [userMoved, setUserMoved] = useState(false);
  const frame = useRef(0);
  const shownRef = useRef<LatLng | null>(null);
  const onEtaRef = useRef(onEta);
  onEtaRef.current = onEta;
  const rotationRef = useRef<number | null>(null);
  const routeReqRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

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
        const next = nextRotation(rotationRef.current, bearingBetween(from, to));
        rotationRef.current = next;
        setRotation(next);
        setTurnReady(true);
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

  // The road the driver is actually going to ride. A straight line between two
  // dots tells the customer nothing about how far away the food really is —
  // 400m as the crow flies can be a 2km loop around the tank bund.
  useEffect(() => {
    if (!token || driverLat == null || driverLng == null) {
      setRoute(null);
      routeReqRef.current = null;
      return;
    }
    const prev = routeReqRef.current;
    const moved = !prev || haversineMeters(prev.lat, prev.lng, driverLat, driverLng) >= ROUTE_REFRESH_M;
    const aged = !prev || Date.now() - prev.at >= ROUTE_MAX_AGE_MS;
    if (!moved && !aged) return;
    routeReqRef.current = { lat: driverLat, lng: driverLng, at: Date.now() };

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLng},${driverLat};${customerLng},${customerLat}` +
            `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`,
          { signal: ctrl.signal },
        );
        const j = (await res.json()) as {
          routes?: { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }[];
        };
        const first = j.routes?.[0];
        const coords = first?.geometry?.coordinates;
        if (!coords?.length) throw new Error("no route");
        setRoute({
          coords,
          distanceM: Number(first?.distance) || 0,
          durationS: Number(first?.duration) || 0,
        });
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        // Directions is a nice-to-have; the straight fallback line below still
        // shows which way the food is coming from. Clear the throttle so the
        // next fix retries instead of waiting out the age window.
        routeReqRef.current = null;
        setRoute(null);
      }
    })();

    return () => ctrl.abort();
  }, [token, driverLat, driverLng, customerLat, customerLng]);

  // Without a road route we still draw driver → door, just dashed, so it reads
  // as "roughly this way" rather than "ride through these buildings".
  const pathFeature = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    const coords: [number, number][] = route?.coords?.length
      ? [...route.coords]
      : driverLat != null && driverLng != null
        ? [
            [driverLng, driverLat],
            [customerLng, customerLat],
          ]
        : [];
    if (coords.length < 2) return null;
    // The road is fetched from the latest ping. The scooter is still gliding
    // toward it, so the line has to start at the scooter or it looks detached.
    if (shown) {
      const [lng, lat] = coords[0];
      if (Math.abs(lng - shown.lng) > 1e-6 || Math.abs(lat - shown.lat) > 1e-6) {
        coords.unshift([shown.lng, shown.lat]);
      }
    }
    return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
  }, [route, driverLat, driverLng, customerLat, customerLng, shown]);

  const onRoad = Boolean(route?.coords?.length);

  // Recentre on each real fix, not on each animated frame — refitting at 60fps
  // would leave the camera permanently mid-ease and the map feeling drunk.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || userMoved) return;
    if (driverLat == null || driverLng == null) {
      map.easeTo({ center: [customerLng, customerLat], zoom: 14, duration: 600 });
      return;
    }
    // Fit the whole road line, not just the endpoints: a route that swings wide
    // would otherwise spill outside the frame.
    const pts: [number, number][] = route?.coords?.length
      ? [...route.coords]
      : [
          [driverLng, driverLat],
          [customerLng, customerLat],
        ];
    // The scooter is still gliding toward this fix. Leave it in the frame,
    // otherwise the camera jumps to the new ping and the rider slides off-screen.
    const riding = shownRef.current;
    if (riding) pts.push([riding.lng, riding.lat]);
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of pts) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: { top: 56, bottom: 56, left: 56, right: 56 }, maxZoom: 15.5, duration: 1200 },
    );
  }, [driverLat, driverLng, customerLat, customerLng, route, userMoved]);

  useEffect(() => {
    const cb = onEtaRef.current;
    if (!cb) return;
    if (!route) {
      cb(null);
      return;
    }
    cb({
      minutes: Math.max(1, Math.round(route.durationS / 60)),
      metres: Math.max(0, Math.round(route.distanceM)),
    });
  }, [route]);

  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle={MAP_STYLE}
        initialViewState={{ longitude: customerLng, latitude: customerLat, zoom: 14 }}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        logoPosition="bottom-right"
        dragRotate={false}
        pitchWithRotate={false}
        touchZoomRotate={false}
        onDragStart={(e) => {
          // Only a real gesture counts; our own fitBounds fires the same event
          // without an originalEvent, and typings don't carry the field.
          if ((e as unknown as { originalEvent?: unknown }).originalEvent) setUserMoved(true);
        }}
      >
        {pathFeature ? (
          <Source id="vk-delivery-route" type="geojson" data={pathFeature}>
            <Layer
              id="vk-delivery-route-casing"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.95 }}
            />
            <Layer
              id="vk-delivery-route-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={
                onRoad
                  ? { "line-color": C.red, "line-width": 4.5, "line-opacity": driverStale ? 0.45 : 1 }
                  : {
                      "line-color": C.red,
                      "line-width": 3.5,
                      "line-opacity": driverStale ? 0.4 : 0.75,
                      "line-dasharray": [1.6, 1.6],
                    }
              }
            />
          </Source>
        ) : null}

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
          <Marker longitude={shown.lng} latitude={shown.lat} anchor="center" style={{ zIndex: 3 }}>
            <div
              aria-hidden
              style={{
                width: 56,
                height: 56,
                backgroundImage: "url(/rider-topdown.png)",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "50% 50%",
                transition: turnReady ? "transform 0.4s ease-out" : "none",
                opacity: driverStale ? 0.55 : 1,
                pointerEvents: "none",
              }}
            />
          </Marker>
        ) : null}
      </Map>

      {userMoved ? (
        <button
          type="button"
          onClick={() => setUserMoved(false)}
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            padding: "7px 12px",
            borderRadius: 999,
            border: `1px solid ${C.border}`,
            background: "rgba(255,255,255,0.96)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            fontSize: 12,
            fontWeight: 800,
            color: C.text,
            cursor: "pointer",
          }}
        >
          Recentre
        </button>
      ) : null}
    </div>
  );
}
