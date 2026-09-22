"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";
import { Motorcycle } from "@phosphor-icons/react";
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

function bearingBetween(from: LatLng, to: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function minutesAgo(at: string | null | undefined): number | null {
  if (!at) return null;
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

export function LiveDeliveryMap({
  token,
  customerLat,
  customerLng,
  driverLat,
  driverLng,
  /** True when the last GPS fix is old enough that the bike is a memory, not a live position. */
  driverStale = false,
  driverFixAt = null,
  height,
}: {
  token: string;
  customerLat: number;
  customerLng: number;
  driverLat: number | null;
  driverLng: number | null;
  driverStale?: boolean;
  driverFixAt?: string | null;
  height: number;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [shown, setShown] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState(0);
  const [route, setRoute] = useState<Route | null>(null);
  const [userMoved, setUserMoved] = useState(false);
  const frame = useRef(0);
  const shownRef = useRef<LatLng | null>(null);
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
      ? route.coords
      : driverLat != null && driverLng != null
        ? [
            [driverLng, driverLat],
            [customerLng, customerLat],
          ]
        : [];
    if (coords.length < 2) return null;
    return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
  }, [route, driverLat, driverLng, customerLat, customerLng]);

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
      ? route.coords
      : [
          [driverLng, driverLat],
          [customerLng, customerLat],
        ];
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
      { padding: { top: 54, bottom: 76, left: 44, right: 44 }, maxZoom: 15.5, duration: 1200 },
    );
  }, [driverLat, driverLng, customerLat, customerLng, route, userMoved]);

  const etaMin = route ? Math.max(1, Math.round(route.durationS / 60)) : null;
  const awayText = route
    ? route.distanceM < 950
      ? `${Math.round(route.distanceM / 10) * 10} m away`
      : `${(route.distanceM / 1000).toFixed(1)} km away`
    : null;
  const staleMin = driverStale ? minutesAgo(driverFixAt) : null;

  const badge =
    driverLat == null
      ? null
      : driverStale
        ? staleMin != null
          ? `Last seen ${staleMin < 1 ? "just now" : `${staleMin} min ago`}`
          : "Last known position"
        : etaMin != null
          ? `${etaMin} min away · ${awayText}`
          : "Driver on the move";

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
          <Marker longitude={shown.lng} latitude={shown.lat} anchor="center">
            <span
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                opacity: driverStale ? 0.55 : 1,
              }}
            >
              {driverStale ? null : (
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
              )}
              <span
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: driverStale ? "#7A7A7A" : "#1A1A1A",
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

      {badge ? (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.96)",
            border: `1px solid ${C.border}`,
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            fontSize: 12,
            fontWeight: 800,
            color: C.text,
            letterSpacing: "-0.01em",
            pointerEvents: "none",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: driverStale ? "#9A9A9A" : C.red,
              animation: driverStale ? undefined : "vkBikeBlink 1.4s ease-in-out infinite",
            }}
          />
          {badge}
        </div>
      ) : null}

      {userMoved ? (
        <button
          type="button"
          onClick={() => setUserMoved(false)}
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
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

      <style>{`
        @keyframes vkBikePulse {
          0% { transform: scale(0.55); opacity: 0.85; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes vkBikeBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
