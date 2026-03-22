import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css"; // Asegúrate de tener esta importación para que el mapa se vea bien
import "./App.css";
import issLogo from "./images/iss1.png";
// Coordenadas de referencia (Montreal)
const MTL_COORDS = [45.5017, -73.5673];

// Configuración del Icono del Satélite
const issIcon = L.icon({
  /*iconUrl: "https://www.flaticon.com/free-icon/station_13426427.png  ", //"https://cdn-icons-png.flaticon.com/512/3344/3344338.png", 2026/2026462.png*/
  iconUrl: issLogo,
  iconSize: [25, 25],
  iconAnchor: [22, 22], // Centrado del icono
});

function App() {
  const mapRef = useRef(null);
  const issMarkerRef = useRef(null);
  const pathRef = useRef(null);

  const [data, setData] = useState({
    lat: 0,
    lon: 0,
    vel: 0,
    dist: 0,
    alt: 0,
    status: "SINCRONIZANDO...",
  });

  const [times, setTimes] = useState({ mtl: "", utc: "" });

  // --- LÓGICA DE RELOJES (MTL y UTC) ---
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

  // --- INICIALIZACIÓN DEL MAPA ---
  useEffect(() => {
    if (!mapRef.current) {
      // Crear instancia del mapa
      const map = L.map("map", {
        zoomControl: false,
        attributionControl: false,
      }).setView([20, -20], 2);

      // Capa de mapa (CartoDB Voyager)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      ).addTo(map);

      // Marcador Estático: Montreal HQ
      L.circleMarker(MTL_COORDS, {
        radius: 7,
        fillColor: "#ff3131",
        color: "#fff",
        weight: 2,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip("MTL HQ", { permanent: false });

      // Marcador Dinámico: ISS (Con el nuevo icono)
      issMarkerRef.current = L.marker([0, 0], { icon: issIcon }).addTo(map);

      // Línea de trayectoria (Path)
      pathRef.current = L.polyline([], {
        color: "#00f2ff",
        weight: 2,
        opacity: 0.5,
      }).addTo(map);

      mapRef.current = map;
    }
  }, []);

  // --- CÁLCULO DE DISTANCIA (Fórmula de Haversine) ---
  const calcDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // --- PETICIÓN A LA API Y ACTUALIZACIÓN ---
  const updateISS = async () => {
    try {
      const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
      if (!res.ok) throw new Error("API Limit");

      const json = await res.json();
      const { latitude, longitude, velocity, altitude } = json;

      const pos = [latitude, longitude];

      // Actualizar posición del marcador y la línea sin re-renderizar todo el componente
      if (issMarkerRef.current) issMarkerRef.current.setLatLng(pos);
      if (pathRef.current) pathRef.current.addLatLng(pos);

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
    const apiInterval = setInterval(updateISS, 5000); // Actualiza cada 5 segundos
    return () => clearInterval(apiInterval);
  }, []);

  return (
    <div className="app-container">
      {/* Header con Relojes */}
      <header>
        <h1 style={{ fontSize: "1rem" }}>🛰️ ISS TRACKER // NODE: MONTREAL</h1>
        <div style={{ textAlign: "right", fontSize: "0.9rem" }}>
          <div style={{ color: "#00f2ff" }}>MTL: {times.mtl}</div>
          <div style={{ color: "#fff", fontSize: "0.7rem" }}>
            UTC: {times.utc}
          </div>
        </div>
      </header>

      {/* Contenedor del Mapa de Leaflet */}
      <div id="map"></div>

      {/* Panel de Datos (Dashboard) */}
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
          <div className="value" style={{ color: "#00f2ff" }}>
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
