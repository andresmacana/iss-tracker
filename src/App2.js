import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "./App.css";

const MTL_COORDS = [45.5017, -73.5673];

function App() {
  const mapRef = useRef(null);
  const issMarkerRef = useRef(null);
  const pathRef = useRef(null);

  const [autoTrack, setAutoTrack] = useState(true); // Control de seguimiento
  const [data, setData] = useState({
    lat: 0,
    lon: 0,
    vel: 0,
    dist: 0,
    alt: 0,
    status: "SINCRONIZANDO...",
  });
  const [times, setTimes] = useState({ mtl: "", utc: "" });

  // Relojes
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimes({
        mtl: now.toLocaleTimeString("en-US", {
          timeZone: "America/Montreal",
          hour12: false,
        }),
        utc: now.toISOString().split("T")[1].split(".")[0],
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Inicialización del Mapa
  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map("map", { zoomControl: false }).setView([20, -20], 3);
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      ).addTo(map);

      // Marcador Montreal
      L.circleMarker(MTL_COORDS, {
        radius: 7,
        fillColor: "#ff3131",
        color: "#fff",
        weight: 2,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip("MONTREAL HQ", { permanent: false });

      // Marcador ISS y Trayectoria
      issMarkerRef.current = L.circleMarker([0, 0], {
        radius: 10,
        fillColor: "#00f2ff",
        color: "#fff",
        weight: 3,
        fillOpacity: 0.8,
      }).addTo(map);

      pathRef.current = L.polyline([], {
        color: "#00f2ff",
        weight: 2,
        opacity: 0.5,
      }).addTo(map);
      mapRef.current = map;
    }
  }, []);

  const calcDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const updateISS = async () => {
    try {
      const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
      if (!res.ok) throw new Error("API Limit");
      const json = await res.json();
      const { latitude, longitude, velocity, altitude } = json;

      const pos = [latitude, longitude];
      if (issMarkerRef.current) issMarkerRef.current.setLatLng(pos);
      if (pathRef.current) pathRef.current.addLatLng(pos);

      // LÓGICA DE AUTO-TRACK
      if (autoTrack && mapRef.current) {
        mapRef.current.panTo(pos, { animate: true, duration: 1.5 });
      }

      const d = calcDist(latitude, longitude, MTL_COORDS[0], MTL_COORDS[1]);

      setData({
        lat: latitude.toFixed(2),
        lon: longitude.toFixed(2),
        vel: Math.round(velocity).toLocaleString(),
        dist: Math.round(d).toLocaleString(),
        alt: altitude.toFixed(2),
        status: "ONLINE",
      });
    } catch (err) {
      setData((prev) => ({ ...prev, status: "REINTENTANDO..." }));
    }
  };

  useEffect(() => {
    updateISS();
    const apiInterval = setInterval(updateISS, 5000);
    return () => clearInterval(apiInterval);
  }, [autoTrack]); // Se reinicia si cambia el modo de rastreo

  return (
    <div className="app-container">
      <header>
        <h1>🛰️ ISS STRATCOM // NODE: MONTREAL</h1>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--mtl)" }}>MTL: {times.mtl}</div>
          <div style={{ color: "#fff", fontSize: "0.7rem" }}>
            UTC: {times.utc}
          </div>
        </div>
      </header>

      <div className="map-controls">
        <button
          className={`btn-track ${autoTrack ? "active" : ""}`}
          onClick={() => setAutoTrack(!autoTrack)}
        >
          {autoTrack ? "AUTO-TRACK: ON" : "AUTO-TRACK: OFF"}
        </button>
      </div>

      <div id="map"></div>

      <div className="dashboard">
        <div className="data-box">
          <div className="label">Coordenadas ISS</div>
          <div className="value">
            {data.lat}°, {data.lon}°
          </div>
        </div>
        <div className="data-box">
          <div className="label">Velocidad Orbital</div>
          <div className="value">{data.vel} km/h</div>
        </div>
        <div className="data-box">
          <div className="label">Distancia a Montreal</div>
          <div className="value" style={{ color: "var(--mtl)" }}>
            {data.dist} km
          </div>
        </div>
        <div className="data-box">
          <div className="label">Altitud (MSL)</div>
          <div className="value">{data.alt} km</div>
        </div>
        <div className="data-box">
          <div className="label">Estado Sistema</div>
          <div
            className={`value ${data.status === "ONLINE" ? "online" : "warning"}`}
          >
            {data.status === "ONLINE" ? "● EN LINEA" : `⚠️ ${data.status}`}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
