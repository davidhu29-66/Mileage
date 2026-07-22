import React, { useState, useEffect, useMemo } from "react";
import {
  Gauge, Clock, Plus, X, Trash2, Settings as SettingsIcon,
  List, BarChart3, ChevronLeft, ChevronRight, Briefcase, Home as HomeIcon,
  Download, ArrowRight, AlertTriangle, Check, Car, LocateFixed, MapPin, Receipt, Mic, Wrench
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";

const DEFAULT_LOCATIONS = [{ name: "Home", lat: null, lng: null }, { name: "Office", lat: null, lng: null }];
const GPS_MATCH_RADIUS_M = 200;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function findNearestLocation(locations, lat, lng, thresholdMeters = GPS_MATCH_RADIUS_M) {
  let best = null;
  let bestDist = Infinity;
  for (const loc of locations) {
    if (loc.lat == null || loc.lng == null) continue;
    const d = haversineMeters(lat, lng, loc.lat, loc.lng);
    if (d < bestDist) {
      bestDist = d;
      best = loc;
    }
  }
  if (best && bestDist <= thresholdMeters) return { ...best, distance: bestDist };
  return null;
}

function getCurrentCoords() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported on this device"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function fmtKm(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
}
function fmtDateLong(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
function sortKey(t) {
  return `${t.date}T${t.timeOut || "00:00"}`;
}
function monthLabel(ym) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function MileageLogger() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [locations, setLocations] = useState(DEFAULT_LOCATIONS);
  const [tab, setTab] = useState("log");
  const [toast, setToast] = useState(null);

  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("trips", false);
        setTrips(res ? JSON.parse(res.value) : []);
      } catch (e) {
        setTrips([]);
      }
      try {
        const res = await window.storage.get("locations", false);
        const raw = res ? JSON.parse(res.value) : DEFAULT_LOCATIONS;
        const migrated = raw.map((l) => (typeof l === "string" ? { name: l, lat: null, lng: null } : l));
        setLocations(migrated);
      } catch (e) {
        setLocations(DEFAULT_LOCATIONS);
      }
      setLoading(false);
    })();
  }, []);

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 2600);
  }

  async function persistTrips(next) {
    setTrips(next);
    try {
      await window.storage.set("trips", JSON.stringify(next), false);
    } catch (e) {
      showToast("error", "Couldn't save that — check your connection.");
    }
  }

  async function persistLocations(next) {
    setLocations(next);
    try {
      await window.storage.set("locations", JSON.stringify(next), false);
    } catch (e) {
      showToast("error", "Couldn't save that location.");
    }
  }

  const sortedTrips = useMemo(
    () => [...trips].sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1)),
    [trips]
  );

  const activeTrip = useMemo(
    () => trips.find((t) => t.mileageIn === null) || null,
    [trips]
  );

  const lastMileage = useMemo(() => {
    const completed = [...trips]
      .filter((t) => t.mileageIn !== null)
      .sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1));
    if (completed.length) return completed[0].mileageIn;
    if (activeTrip) return activeTrip.mileageOut;
    return null;
  }, [trips, activeTrip]);

  const lastMileageMeta = useMemo(() => {
    const completed = [...trips]
      .filter((t) => t.mileageIn !== null)
      .sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1));
    if (completed.length) {
      return { date: completed[0].date, time: completed[0].timeIn, where: completed[0].toLocation };
    }
    return null;
  }, [trips]);

  function upsertLocation(name, lat, lng) {
    const clean = (name || "").trim();
    if (!clean) return;
    const idx = locations.findIndex((l) => l.name === clean);
    if (idx === -1) {
      persistLocations([...locations, { name: clean, lat: lat ?? null, lng: lng ?? null }]);
    } else if (lat != null && lng != null) {
      const next = locations.slice();
      next[idx] = { ...next[idx], lat, lng };
      persistLocations(next);
    }
  }

  function startTrip(data) {
    const trip = {
      id: uid(),
      date: data.date,
      timeOut: data.timeOut,
      mileageOut: Number(data.mileageOut),
      fromLocation: data.fromLocation,
      toLocation: null,
      timeIn: null,
      mileageIn: null,
      category: data.category,
      businessType: data.category === "business" ? data.businessType : null,
      client: data.category === "business" && data.businessType === "chargeable" ? (data.client || "") : "",
      purpose: data.purpose || "",
      siteHours: Number(data.siteHours || 0),
      workNotes: data.workNotes || "",
    };
    persistTrips([...trips, trip]);
    upsertLocation(data.fromLocation, data.fromLocationCoords?.lat, data.fromLocationCoords?.lng);
    setShowStart(false);
    showToast("success", "Trip started — safe driving.");
  }

  function endTrip(id, data) {
    const next = trips.map((t) =>
      t.id === id
        ? {
            ...t,
            timeIn: data.timeIn,
            mileageIn: Number(data.mileageIn),
            toLocation: data.toLocation,
            siteHours: Number(data.siteHours || 0),
            workNotes: data.workNotes || "",
          }
        : t
    );
    persistTrips(next);
    upsertLocation(data.toLocation, data.toLocationCoords?.lat, data.toLocationCoords?.lng);
    setShowEnd(false);
    showToast("success", "Trip logged.");
  }

  function saveFullTrip(data, existingId) {
    if (existingId) {
      const next = trips.map((t) =>
        t.id === existingId
          ? {
              ...t,
              date: data.date,
              timeOut: data.timeOut,
              mileageOut: Number(data.mileageOut),
              fromLocation: data.fromLocation,
              timeIn: data.timeIn,
              mileageIn: Number(data.mileageIn),
              toLocation: data.toLocation,
              category: data.category,
              businessType: data.category === "business" ? data.businessType : null,
              client: data.category === "business" && data.businessType === "chargeable" ? (data.client || "") : "",
              purpose: data.purpose || "",
              siteHours: Number(data.siteHours || 0),
              workNotes: data.workNotes || "",
            }
          : t
      );
      persistTrips(next);
      showToast("success", "Trip updated.");
    } else {
      const trip = {
        id: uid(),
        date: data.date,
        timeOut: data.timeOut,
        mileageOut: Number(data.mileageOut),
        fromLocation: data.fromLocation,
        timeIn: data.timeIn,
        mileageIn: Number(data.mileageIn),
        toLocation: data.toLocation,
        category: data.category,
        businessType: data.category === "business" ? data.businessType : null,
        client: data.category === "business" && data.businessType === "chargeable" ? (data.client || "") : "",
        purpose: data.purpose || "",
        siteHours: Number(data.siteHours || 0),
        workNotes: data.workNotes || "",
      };
      persistTrips([...trips, trip]);
      showToast("success", "Trip added.");
    }
    upsertLocation(data.fromLocation, data.fromLocationCoords?.lat, data.fromLocationCoords?.lng);
    upsertLocation(data.toLocation, data.toLocationCoords?.lat, data.toLocationCoords?.lng);
    setShowFull(false);
    setEditingTrip(null);
  }

  function deleteTrip(id) {
    persistTrips(trips.filter((t) => t.id !== id));
    setConfirmDelete(null);
    showToast("success", "Trip deleted.");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 text-sm font-medium tracking-wide">Loading your logbook…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <Header 
        lastMileage={lastMileage} 
        lastMileageMeta={lastMileageMeta} 
        activeTrip={activeTrip} 
        onVoiceTrigger={() => showToast("success", "Voice command listening... (Say 'Start trip' or 'End trip')")}
      />

      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 no-scrollbar">
        {tab === "log" && (
          <LogTab
            activeTrip={activeTrip}
            recentTrips={sortedTrips.slice(0, 3)}
            onStart={() => setShowStart(true)}
            onEnd={() => setShowEnd(true)}
            onFull={() => { setEditingTrip(null); setShowFull(true); }}
            onViewAll={() => setTab("history")}
            onEditTrip={(t) => setEditingTrip(t)}
          />
        )}
        {tab === "history" && (
          <HistoryTab trips={sortedTrips} onEdit={(t) => setEditingTrip(t)} />
        )}
        {tab === "summary" && <SummaryTab trips={trips} />}
        {tab === "settings" && (
          <SettingsTab
            locations={locations}
            onAddLocation={(name) => upsertLocation(name)}
            onRemoveLocation={(name) => persistLocations(locations.filter((l) => l.name !== name))}
            onPinLocation={(name, lat, lng) => upsertLocation(name, lat, lng)}
            trips={trips}
          />
        )}
      </main>

      <BottomNav tab={tab} setTab={setTab} />

      {showStart && (
        <StartTripModal
          locations={locations}
          suggestedMileage={lastMileage}
          onClose={() => setShowStart(false)}
          onSave={startTrip}
        />
      )}
      {showEnd && activeTrip && (
        <EndTripModal
          trip={activeTrip}
          locations={locations}
          onClose={() => setShowEnd(false)}
          onSave={(data) => endTrip(activeTrip.id, data)}
        />
      )}
      {(showFull || editingTrip) && (
        <FullTripModal
          locations={locations}
          initial={editingTrip}
          onClose={() => { setShowFull(false); setEditingTrip(null); }}
          onSave={(data) => saveFullTrip(data, editingTrip ? editingTrip.id : null)}
          onDelete={editingTrip ? () => setConfirmDelete(editingTrip.id) : null}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this trip?"
          message="This can't be undone."
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => { deleteTrip(confirmDelete); setEditingTrip(null); }}
        />
      )}
      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}

function Header({ lastMileage, lastMileageMeta, activeTrip, onVoiceTrigger }) {
  return (
    <div className="px-5 pt-6 pb-5 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col gap-1">
          <img src="/logo.png" alt="Company logo" className="h-8 w-auto object-contain object-left" />
          <span className="text-xs uppercase tracking-widest text-slate-500">Mileage Logbook</span>
        </div>
        <div className="flex items-center gap-2">
          {activeTrip && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Trip in progress</span>
            </div>
          )}
          <button 
            onClick={onVoiceTrigger}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400"
            title="Voice Commands / Gemini Assistant"
          >
            <Mic size={16} />
          </button>
        </div>
      </div>
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Last recorded odometer</div>
      <div className="flex items-baseline gap-2">
        <span className="font-odo text-4xl font-bold text-slate-50">{lastMileage !== null ? fmtKm(lastMileage) : "—"}</span>
        <span className="text-slate-500 text-sm font-medium">km</span>
      </div>
      {lastMileageMeta && (
        <div className="text-xs text-slate-500 mt-1">
          {fmtDateLong(lastMileageMeta.date)} at {lastMileageMeta.time} · {lastMileageMeta.where}
        </div>
      )}
    </div>
  );
}

function LogTab({ activeTrip, recentTrips, onStart, onEnd, onFull, onViewAll, onEditTrip }) {
  return (
    <div className="space-y-4">
      {activeTrip ? (
        <div className="rounded-2xl bg-slate-900 border border-emerald-400/20 p-4">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wide mb-3">
            <Clock size={14} /> Trip in progress
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 text-sm">From</span>
            <span className="text-slate-100 font-medium">{activeTrip.fromLocation}</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 text-sm">Left at</span>
            <span className="font-odo text-slate-100">{activeTrip.timeOut}</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-sm">Odometer out</span>
            <span className="font-odo text-slate-100">{fmtKm(activeTrip.mileageOut)} km</span>
          </div>
          <button
            onClick={onEnd}
            className="w-full py-3.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            End Trip <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={onStart}
          className="w-full py-5 rounded-2xl bg-amber-400 text-slate-950 font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-amber-400/10"
        >
          <Car size={20} /> Start Trip
        </button>
      )}

      <button
        onClick={onFull}
        className="w-full py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <Plus size={16} /> Log a completed trip
      </button>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-300">Recent trips</span>
          <button onClick={onViewAll} className="text-xs text-amber-400 font-medium flex items-center gap-0.5">
            View all <ChevronRight size={12} />
          </button>
        </div>
        {recentTrips.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-slate-500 text-sm">No trips logged yet</div>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTrips.map((t) => (
              <TripRow key={t.id} trip={t} onClick={() => onEditTrip(t)} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TripRow({ trip, onClick, compact }) {
  const isBiz = trip.category === "business";
  const isChargeable = isBiz && trip.businessType === "chargeable";
  const km = trip.mileageIn !== null ? trip.mileageIn - trip.mileageOut : null;
  const iconWrapCls = isChargeable ? "bg-sky-400/10" : isBiz ? "bg-emerald-400/10" : "bg-rose-400/10";
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-800 p-3 flex items-center gap-3 transition-colors"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconWrapCls}`}>
        {isChargeable ? (
          <Receipt size={15} className="text-sky-400" />
        ) : isBiz ? (
          <Briefcase size={15} className="text-emerald-400" />
        ) : (
          <HomeIcon size={15} className="text-rose-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-sm font-medium text-slate-100 truncate">
          <span className="truncate">{trip.fromLocation}</span>
          <ArrowRight size={11} className="text-slate-600 shrink-0" />
          <span className="truncate">{trip.toLocation || "—"}</span>
        </div>
        <div className="text-xs text-slate-500">
          {fmtDateLong(trip.date)}{!compact ? ` · ${trip.timeOut}–${trip.timeIn || "…"}` : ""}
          {trip.siteHours > 0 && <span className="text-amber-400 font-semibold"> · {trip.siteHours}h onsite</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-odo text-sm font-semibold text-slate-100">{km !== null ? fmtKm(km) : "…"}</div>
        <div className="text-xs text-slate-500">km</div>
      </div>
    </button>
  );
}

function HistoryTab({ trips, onEdit }) {
  if (trips.length === 0) {
    return (
      <div className="text-center py-16">
        <List size={28} className="text-slate-700 mx-auto mb-3" />
        <div className="text-slate-400 text-sm font-medium">No trips yet</div>
      </div>
    );
  }
  const groups = {};
  trips.forEach((t) => {
    const ym = t.date.slice(0, 7);
    if (!groups[ym]) groups[ym] = [];
    groups[ym].push(t);
  });
  const months = Object.keys(groups).sort().reverse();
  return (
    <div className="space-y-5">
      {months.map((ym) => (
        <div key={ym}>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">
            {monthLabel(ym)}
          </div>
          <div className="space-y-2">
            {groups[ym].map((t) => (
              <TripRow key={t.id} trip={t} onClick={() => onEdit(t)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryTab({ trips }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const target = new Date();
  target.setDate(1);
  target.setMonth(target.getMonth() + monthOffset);
  const ym = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;

  const monthTrips = trips.filter((t) => t.date.slice(0, 7) === ym && t.mileageIn !== null);
  const totalKm = monthTrips.reduce((s, t) => s + (t.mileageIn - t.mileageOut), 0);
  const bizTrips = monthTrips.filter((t) => t.category === "business");
  const bizKm = bizTrips.reduce((s, t) => s + (t.mileageIn - t.mileageOut), 0);
  const privKm = totalKm - bizKm;
  const bizPct = totalKm > 0 ? Math.round((bizKm / totalKm) * 100) : 0;

  function exportCsv(filter) {
    const rows = trips
      .filter((t) => {
        if (t.mileageIn === null) return false;
        if (filter === "business") return t.category === "business";
        if (filter === "chargeable") return t.category === "business" && t.businessType === "chargeable";
        if (filter === "onsite") return (t.siteHours || 0) > 0;
        return true;
      })
      .sort((a, b) => (sortKey(a) > sortKey(b) ? 1 : -1));

    let header, lines;

    if (filter === "onsite") {
      header = ["Date", "Location", "Time In", "Time Out", "Onsite Hours", "Work Details", "Odometer In", "Odometer Out"];
      lines = [header.join(",")];
      rows.forEach((t) => {
        const line = [
          t.date,
          `"${(t.toLocation || t.fromLocation || "").replace(/"/g, '""')}"`,
          t.timeOut,
          t.timeIn,
          t.siteHours || 0,
          `"${(t.workNotes || "").replace(/"/g, '""')}"`,
          t.mileageOut,
          t.mileageIn
        ];
        lines.push(line.join(","));
      });
    } else {
      header = ["Date", "Time Out", "From", "Odometer Out", "Time In", "To", "Odometer In", "KM", "Category", "Business Type", "Client", "Purpose", "Onsite Hours", "Work Notes"];
      lines = [header.join(",")];
      rows.forEach((t) => {
        const line = [
          t.date, t.timeOut, t.fromLocation, t.mileageOut,
          t.timeIn, t.toLocation, t.mileageIn, t.mileageIn - t.mileageOut,
          t.category, t.businessType || "", `"${(t.client || "").replace(/"/g, '""')}"`,
          `"${(t.purpose || "").replace(/"/g, '""')}"`,
          t.siteHours || 0, `"${(t.workNotes || "").replace(/"/g, '""')}"`
        ];
        lines.push(line.join(","));
      });
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mileage-log-${filter}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonthOffset((m) => m - 1)} className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
          <ChevronLeft size={16} className="text-slate-400" />
        </button>
        <span className="font-semibold text-slate-200 text-sm">{monthLabel(ym)}</span>
        <button onClick={() => setMonthOffset((m) => Math.min(0, m + 1))} disabled={monthOffset >= 0} className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center disabled:opacity-30">
          <ChevronRight size={16} className="text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total" value={fmtKm(totalKm)} sub="km" />
        <StatCard label="Business" value={fmtKm(bizKm)} sub="km" accent="emerald" />
        <StatCard label="Private" value={fmtKm(privKm)} sub="km" accent="rose" />
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2">
        <div className="text-sm font-semibold text-slate-300 mb-1">Export Reports</div>
        <button onClick={() => exportCsv("all")} className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-medium flex items-center justify-center gap-2">
          <Download size={14} /> All trips (CSV)
        </button>
        <button onClick={() => exportCsv("business")} className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-medium flex items-center justify-center gap-2">
          <Download size={14} /> Business trips only (CSV)
        </button>
        <button onClick={() => exportCsv("onsite")} className="w-full py-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 text-sm font-medium flex items-center justify-center gap-2">
          <Clock size={14} /> Onsite Time & Activity Log (CSV)
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  const color =
    accent === "emerald" ? "text-emerald-400" :
    accent === "rose" ? "text-rose-400" :
    "text-slate-100";
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className={`font-odo text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function SettingsTab({ locations, onAddLocation, onRemoveLocation, onPinLocation, trips }) {
  const [newLoc, setNewLoc] = useState("");
  const [pinningName, setPinningName] = useState(null);

  async function handlePin(name) {
    setPinningName(name);
    try {
      const { lat, lng } = await getCurrentCoords();
      onPinLocation(name, lat, lng);
    } catch (e) {}
    setPinningName(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="text-sm font-semibold text-slate-300 mb-1">Saved locations</div>
        <div className="flex flex-col gap-2 mb-3">
          {locations.map((loc) => (
            <div key={loc.name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800">
              <MapPin size={14} className={loc.lat ? "text-emerald-400 shrink-0" : "text-slate-600 shrink-0"} />
              <span className="flex-1 text-sm text-slate-200">{loc.name}</span>
              <button onClick={() => handlePin(loc.name)} className="text-xs font-medium px-2 py-1 rounded-lg bg-amber-400/10 text-amber-400">
                {pinningName === loc.name ? "Pinning…" : loc.lat ? "Re-pin" : "Pin here"}
              </button>
              <button onClick={() => onRemoveLocation(loc.name)}><X size={13} className="text-slate-500" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { id: "log", icon: Gauge, label: "Log" },
    { id: "history", icon: List, label: "History" },
    { id: "summary", icon: BarChart3, label: "Summary" },
    { id: "settings", icon: SettingsIcon, label: "Settings" },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-2 pb-safe">
      <div className="flex items-center justify-around">
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} className="flex flex-col items-center gap-1 py-2.5 px-3 flex-1">
              <Icon size={19} className={active ? "text-amber-400" : "text-slate-500"} />
              <span className={`text-xs font-medium ${active ? "text-amber-400" : "text-slate-500"}`}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md bg-slate-900 rounded-t-3xl border-t border-slate-700 flex flex-col max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-2.5"><div className="w-9 h-1 rounded-full bg-slate-700" /></div>
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <span className="font-bold text-slate-100">{title}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><X size={15} className="text-slate-400" /></button>
        </div>
        <div className="px-5 pb-3 overflow-y-auto no-scrollbar">{children}</div>
        {footer && <div className="px-5 pb-6 pt-2 border-t border-slate-800">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-medium text-slate-400 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400/50 font-odo";
const inputClsPlain = "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400/50";

function OnsiteFields({ siteHours, setSiteHours, workNotes, setWorkNotes }) {
  return (
    <div className="p-3 bg-slate-800/60 border border-slate-700/80 rounded-xl space-y-2 mb-3">
      <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
        <Wrench size={13} /> Onsite Time & Activity
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="text-[10px] text-slate-400 mb-1 block">Hours</label>
          <input type="number" step="0.5" placeholder="7.5" value={siteHours} onChange={(e) => setSiteHours(e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] text-slate-400 mb-1 block">Work Done / Notes</label>
          <input type="text" placeholder="e.g. CCTV switch repair" value={workNotes} onChange={(e) => setWorkNotes(e.target.value)} className={inputClsPlain} />
        </div>
      </div>
    </div>
  );
}

function StartTripModal({ locations, suggestedMileage, onClose, onSave }) {
  const [date, setDate] = useState(todayStr());
  const [timeOut, setTimeOut] = useState(nowTimeStr());
  const [mileageOut, setMileageOut] = useState(suggestedMileage !== null ? String(suggestedMileage) : "");
  const [fromLocation, setFromLocation] = useState(locations[0]?.name || "");
  const [category, setCategory] = useState("business");
  const [siteHours, setSiteHours] = useState("");
  const [workNotes, setWorkNotes] = useState("");

  return (
    <Modal title="Start Trip" onClose={onClose} footer={<button onClick={() => onSave({ date, timeOut, mileageOut, fromLocation, category, siteHours, workNotes })} className="w-full py-3.5 rounded-xl bg-amber-400 text-slate-950 font-bold">Start Trip</button>}>
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClsPlain} /></Field>
      <Field label="Odometer out (km)"><input type="number" value={mileageOut} onChange={(e) => setMileageOut(e.target.value)} className={inputCls} /></Field>
      <OnsiteFields siteHours={siteHours} setSiteHours={setSiteHours} workNotes={workNotes} setWorkNotes={setWorkNotes} />
    </Modal>
  );
}

function EndTripModal({ trip, locations, onClose, onSave }) {
  const [timeIn, setTimeIn] = useState(nowTimeStr());
  const [mileageIn, setMileageIn] = useState("");
  const [toLocation, setToLocation] = useState(locations[0]?.name || "");
  const [siteHours, setSiteHours] = useState("");
  const [workNotes, setWorkNotes] = useState("");

  return (
    <Modal title="End Trip" onClose={onClose} footer={<button onClick={() => onSave({ timeIn, mileageIn, toLocation, siteHours, workNotes })} className="w-full py-3.5 rounded-xl bg-amber-400 text-slate-950 font-bold">End Trip</button>}>
      <Field label="Odometer in (km)"><input type="number" value={mileageIn} onChange={(e) => setMileageIn(e.target.value)} className={inputCls} /></Field>
      <OnsiteFields siteHours={siteHours} setSiteHours={setSiteHours} workNotes={workNotes} setWorkNotes={setWorkNotes} />
    </Modal>
  );
}

function FullTripModal({ locations, initial, onClose, onSave, onDelete }) {
  const [date, setDate] = useState(initial?.date || todayStr());
  const [timeOut, setTimeOut] = useState(initial?.timeOut || nowTimeStr());
  const [mileageOut, setMileageOut] = useState(initial ? String(initial.mileageOut) : "");
  const [fromLocation, setFromLocation] = useState(initial?.fromLocation || locations[0]?.name || "");
  const [timeIn, setTimeIn] = useState(initial?.timeIn || nowTimeStr());
  const [mileageIn, setMileageIn] = useState(initial?.mileageIn !== null ? String(initial.mileageIn) : "");
  const [toLocation, setToLocation] = useState(initial?.toLocation || locations[1]?.name || locations[0]?.name || "");
  const [category, setCategory] = useState(initial?.category || "business");
  const [siteHours, setSiteHours] = useState(initial?.siteHours || "");
  const [workNotes, setWorkNotes] = useState(initial?.workNotes || "");

  return (
    <Modal title={initial ? "Edit Trip" : "Log Completed Trip"} onClose={onClose} footer={<button onClick={() => onSave({ date, timeOut, mileageOut, fromLocation, timeIn, mileageIn, toLocation, category, siteHours, workNotes })} className="w-full py-3.5 rounded-xl bg-amber-400 text-slate-950 font-bold">Save Trip</button>}>
      <Field label="Odometer out"><input type="number" value={mileageOut} onChange={(e) => setMileageOut(e.target.value)} className={inputCls} /></Field>
      <Field label="Odometer in"><input type="number" value={mileageIn} onChange={(e) => setMileageIn(e.target.value)} className={inputCls} /></Field>
      <OnsiteFields siteHours={siteHours} setSiteHours={setSiteHours} workNotes={workNotes} setWorkNotes={setWorkNotes} />
    </Modal>
  );
}

function ConfirmDialog({ title, message, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5">
        <div className="font-bold text-slate-100 mb-1">{title}</div>
        <div className="text-sm text-slate-400 mb-4">{message}</div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-semibold">Delete</button>
        </div>
      </div>
    </div>
  );
}

function Toast({ type, message }) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-slate-800 border border-slate-700 shadow-xl flex items-center gap-2">
      {type === "success" ? <Check size={14} className="text-emerald-400" /> : <AlertTriangle size={14} className="text-rose-400" />}
      <span className="text-sm text-slate-200 font-medium">{message}</span>
    </div>
  );
}
