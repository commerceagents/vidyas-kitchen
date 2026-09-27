"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";
import along from "@turf/along";
import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
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

type RoadLine = GeoJSON.Feature<GeoJSON.LineString>;

const ALONG = { units: "kilometers" as const };
/** Two samples this far apart give a stable nose heading through a bend. */
const HEADING_STEP_KM = 0.01;

function roadLine(coords: [number, number][]): RoadLine | null {
  if (coords.length < 2) return null;
  return lineString(coords);
}

/** Distance along the road, in kilometres. GPS is only used to pick this spot. */
function snapAlong(line: RoadLine, lng: number, lat: number): { km: number; index: number } | null {
  const snapped = nearestPointOnLine(line, point([lng, lat]), ALONG);
  const km = snapped.properties?.location;
  const index = snapped.properties?.index;
  if (typeof km !== "number" || !Number.isFinite(km)) return null;
  return { km, index: typeof index === "number" ? index : 0 };
}

function pointAtKm(line: RoadLine, km: number): LatLng {
  const [lng, lat] = along(line, Math.max(0, km), ALONG).geometry.coordinates;
  return { lng, lat };
}

function headingAtKm(line: RoadLine, km: number): number {
  const a = pointAtKm(line, km);
  const ahead = pointAtKm(line, km + HEADING_STEP_KM);
  if (haversineMeters(a.lat, a.lng, ahead.lat, ahead.lng) >= 3) return bearingBetween(a, ahead);
  const behind = pointAtKm(line, Math.max(0, km - HEADING_STEP_KM));
  if (haversineMeters(behind.lat, behind.lng, a.lat, a.lng) < 3) return 0;
  return bearingBetween(behind, a);
}

/** Red line from the scooter forward, staying on the polyline instead of a chord. */
function tailFromRider(coords: [number, number][], here: LatLng | null): [number, number][] {
  if (!here) return coords;
  const line = roadLine(coords);
  if (!line) return coords;
  const snap = snapAlong(line, here.lng, here.lat);
  if (!snap) return coords;
  const at = pointAtKm(line, snap.km);
  const tail: [number, number][] = [[at.lng, at.lat]];
  for (const c of coords.slice(snap.index + 1)) {
    if (Math.abs(c[0] - at.lng) < 1e-7 && Math.abs(c[1] - at.lat) < 1e-7) continue;
    tail.push(c);
  }
  // At the door the road ahead is gone. Drawing the whole line again paints
  // the street already ridden, which reads as a route pointing the wrong way.
  return tail.length >= 2 ? tail : [];
}

/**
 * Door mark: a still dot the route meets, and a dark circle above it.
 * Only the circle springs in. The house is an outline, not a solid stamp.
 */
function HomePin() {
  return (
    <div aria-hidden style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, pointerEvents: "none" }}>
      <motion.div
        initial={{ scale: 0.35, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 140, damping: 12, mass: 0.9 }}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "#1C1C1E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transformOrigin: "50% 50%",
        }}
      >
        <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden>
          <path d="M2 7.2 9 1.4 16 7.2" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.4 6.8V14.2H7.1V9.6H10.9V14.2H14.6V6.8" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </motion.div>
      <div style={{ width: 2, height: 6, background: "#1C1C1E" }} />
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1C1C1E" }} />
    </div>
  );
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
  /** The polyline the scooter is actually riding, which can lag one GPS ping behind the latest fetch. */
  const [roadCoords, setRoadCoords] = useState<[number, number][] | null>(null);
  const [userMoved, setUserMoved] = useState(false);
  const frame = useRef(0);
  const shownRef = useRef<LatLng | null>(null);
  const onEtaRef = useRef(onEta);
  onEtaRef.current = onEta;
  const rotationRef = useRef<number | null>(null);
  const routeReqRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const roadRef = useRef<RoadLine | null>(null);
  const alongKmRef = useRef(0);
  const glidingRef = useRef(false);
  const routeRef = useRef<Route | null>(null);

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  const settleOnLatestRoute = () => {
    const latest = routeRef.current;
    if (!latest || latest.coords.length < 2) return;
    const line = roadLine(latest.coords);
    if (!line) return;
    roadRef.current = line;
    setRoadCoords(latest.coords);
    const here = shownRef.current;
    if (!here) return;
    const snap = snapAlong(line, here.lng, here.lat);
    if (!snap) return;
    alongKmRef.current = snap.km;
    const p = pointAtKm(line, snap.km);
    shownRef.current = p;
    setShown(p);
    const next = nextRotation(rotationRef.current, headingAtKm(line, snap.km));
    rotationRef.current = next;
    setRotation(next);
  };

  useEffect(() => {
    if (driverLat == null || driverLng == null) return;
    const to = { lat: driverLat, lng: driverLng };
    const from = shownRef.current;
    const line = roadRef.current;

    const stop = () => {
      cancelAnimationFrame(frame.current);
      glidingRef.current = false;
    };

    if (!from) {
      if (line) {
        const snap = snapAlong(line, to.lng, to.lat);
        if (snap) {
          alongKmRef.current = snap.km;
          const p = pointAtKm(line, snap.km);
          shownRef.current = p;
          setShown(p);
          const next = nextRotation(null, headingAtKm(line, snap.km));
          rotationRef.current = next;
          setRotation(next);
          return;
        }
      }
      frame.current = requestAnimationFrame(() => setShown(to));
      return () => cancelAnimationFrame(frame.current);
    }

    // The sample (and a driver who heads back out) can jump from the door to
    // the kitchen in one fix. Gliding that on the old road rides it in reverse.
    const fartherFromDoor =
      haversineMeters(to.lat, to.lng, customerLat, customerLng) >
      haversineMeters(from.lat, from.lng, customerLat, customerLng) + 80;
    if (fartherFromDoor) {
      roadRef.current = null;
      setRoadCoords(null);
      alongKmRef.current = 0;
      shownRef.current = to;
      setShown(to);
      const next = nextRotation(rotationRef.current, bearingBetween(to, { lat: customerLat, lng: customerLng }));
      rotationRef.current = next;
      setRotation(next);
      return;
    }

    if (line) {
      const snap = snapAlong(line, to.lng, to.lat);
      if (snap) {
        if (Math.abs(snap.km - alongKmRef.current) < 0.008) return;
        const fromKm = alongKmRef.current;
        const toKm = snap.km;
        glidingRef.current = true;
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / GLIDE_MS);
          const km = fromKm + (toKm - fromKm) * t;
          alongKmRef.current = km;
          const active = roadRef.current ?? line;
          const p = pointAtKm(active, km);
          shownRef.current = p;
          setShown(p);
          const next = nextRotation(rotationRef.current, headingAtKm(active, km));
          rotationRef.current = next;
          setRotation(next);
          setTurnReady(true);
          if (t < 1) {
            frame.current = requestAnimationFrame(step);
            return;
          }
          glidingRef.current = false;
          settleOnLatestRoute();
        };
        frame.current = requestAnimationFrame(step);
        return stop;
      }
    }

    if (from.lat === to.lat && from.lng === to.lng) return;
    glidingRef.current = true;
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
      const t = Math.min(1, (now - start) / GLIDE_MS);
      const p = {
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
      };
      shownRef.current = p;
      setShown(p);
      if (t < 1) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      glidingRef.current = false;
      settleOnLatestRoute();
    };
    frame.current = requestAnimationFrame(step);
    return stop;
  }, [driverLat, driverLng]);

  // Once a glide finishes, or as soon as the first road arrives, lock the
  // scooter onto that polyline. A glide already in flight keeps its road so
  // the distance it's animating stays meaningful.
  useEffect(() => {
    routeRef.current = route;
    if (glidingRef.current) return;
    if (!route?.coords || route.coords.length < 2) return;
    const line = roadLine(route.coords);
    if (!line) return;
    roadRef.current = line;
    setRoadCoords(route.coords);
    const here = shownRef.current;
    // After a restart the marker can still be sitting on the door while the
    // new fix is back at the kitchen. Follow the fix, not the stale marker.
    const jumped =
      here != null &&
      driverLat != null &&
      driverLng != null &&
      haversineMeters(here.lat, here.lng, driverLat, driverLng) > 80;
    const lng = jumped ? driverLng : here?.lng ?? driverLng;
    const lat = jumped ? driverLat : here?.lat ?? driverLat;
    if (lng == null || lat == null) return;
    const snap = snapAlong(line, lng, lat);
    if (!snap) return;
    alongKmRef.current = snap.km;
    const p = pointAtKm(line, snap.km);
    shownRef.current = p;
    setShown(p);
    const next = nextRotation(rotationRef.current, headingAtKm(line, snap.km));
    rotationRef.current = next;
    setRotation(next);
  }, [route, driverLat, driverLng]);

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
    if (roadCoords && roadCoords.length >= 2) {
      const coords = tailFromRider(roadCoords, shown);
      if (coords.length < 2) return null;
      return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
    }
    if (driverLat == null || driverLng == null) return null;
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [driverLng, driverLat],
          [customerLng, customerLat],
        ],
      },
    };
  }, [roadCoords, shown, driverLat, driverLng, customerLat, customerLng]);

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
    const pts: [number, number][] = roadCoords?.length
      ? [...roadCoords]
      : route?.coords?.length
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
      { padding: { top: 72, bottom: 64, left: 56, right: 56 }, maxZoom: 15.5, duration: 1200 },
    );
  }, [driverLat, driverLng, customerLat, customerLng, route, roadCoords, userMoved]);

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
    <div className="vk-live-map" style={{ width: "100%", height, position: "relative" }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        mapStyle={MAP_STYLE}
        initialViewState={{ longitude: customerLng, latitude: customerLat, zoom: 14 }}
        style={{ width: "100%", height: "100%" }}
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

        <Marker
          longitude={customerLng}
          latitude={customerLat}
          anchor="bottom"
          rotation={0}
          rotationAlignment="viewport"
          pitchAlignment="viewport"
          style={{ background: "transparent", border: "none", lineHeight: 0 }}
        >
          <HomePin />
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
                transition: roadCoords ? "none" : turnReady ? "transform 0.4s ease-out" : "none",
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
      <style>{`
        .vk-live-map .mapboxgl-ctrl-bottom-left {
          transform: scale(0.75);
          transform-origin: bottom left;
          opacity: 0.6;
        }
        .vk-live-map .mapboxgl-ctrl-bottom-right {
          transform: scale(0.75);
          transform-origin: bottom right;
          opacity: 0.6;
        }
        .vk-live-map .mapboxgl-ctrl-attrib {
          background: transparent !important;
          font-size: 10px;
        }
      `}</style>
    </div>
  );
}
