import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Plain Leaflet + OpenStreetMap: free, no API key, no card. Click the map to set a point.
export default function LocationPicker({ value, onChange, height = 280 }) {
  const el = useRef(null), map = useRef(null), mk = useRef(null), cb = useRef(onChange);

  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const mapInstance = L.map(el.current).setView([23.8103, 90.4125], 7);
    map.current = mapInstance;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(mapInstance);
    mapInstance.on("click", (e) => cb.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    return () => { mapInstance.remove(); map.current = null; mk.current = null; };
  }, []);

  useEffect(() => {
    if (value?.lat == null) return;
    const p = [value.lat, value.lng];
    if (!mk.current) mk.current = L.circleMarker(p, { radius: 9, color: "#2DD4BF", fillOpacity: 0.8 }).addTo(map.current);
    else mk.current.setLatLng(p);
    map.current.setView(p, Math.max(map.current.getZoom(), 14));
  }, [value?.lat, value?.lng]);

  return <div ref={el} style={{ height }} className="herbal-map relative z-0 w-full overflow-hidden rounded-xl" />;
}
