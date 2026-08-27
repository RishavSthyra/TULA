"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { DeveloperConfigSection } from "@/types/developer-config";

type SectionMeta = {
  id: DeveloperConfigSection;
  label: string;
  description: string;
};

type ApiSection = { config: Record<string, unknown>; revision: number; updatedAt: string | null };

const SECTIONS: SectionMeta[] = [
  { id: "home", label: "Home", description: "Entry, hero, loop, posters and logo" },
  { id: "master-plan", label: "Master plan", description: "Scrub video, GLBs, A1–A4 and tower anchors" },
  { id: "interior", label: "Interior panos", description: "Furnished / bare-shell bases, nodes and maps" },
  { id: "exterior", label: "Exterior panos", description: "Pano base, node graph and minimap" },
  { id: "amenities", label: "Amenities", description: "Page content, videos, preview images and exterior pins" },
  { id: "fallback-assets", label: "Fallbacks", description: "Graceful-image fallbacks used across the experience" },
];

const HOME_FIELDS = [
  "entryVideoKey", "heroVideoKey", "heroLoopVideoKey", "heroMobileFallbackKey",
  "heroStageFallbackKey", "heroPosterKey", "heroLogoKey", "masterPlanWarmupVideoKey",
];
const MASTER_ASSET_FIELDS = [
  "scrubVideoKey", "interactionVideoKey", "hlsPath", "fallbackImageKey", "towerAModelKey", "towerBModelKey", "topViewVideoUrl",
];
const INTERIOR_FIELDS = [
  "furnishedPanoBasePath", "bareShellPanoBasePath", "balconyPanoBasePath", "furnishedInitialNodeId", "bareShellInitialNodeId", "furnishedMinimapKey", "bareShellMinimapKey", "fallbackImageKey",
];
const EXTERIOR_FIELDS = [
  "panoBasePath", "initialNodeId", "initialPreviewKey", "minimapKey", "fallbackImageKey", "title", "subtitle",
];
const FALLBACK_FIELDS = [
  "masterPlanStageFallbackKey", "exteriorMinimapFallbackKey", "interiorFallbackKey", "homeFallbackKey",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function fieldLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function normalizeR2KeyInput(value: string) {
  const trimmed = value.trim().replace(/^\/+/, "");
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function updatePath(value: unknown, path: string[], next: unknown): unknown {
  const [head, ...tail] = path;
  if (!head) return value;
  if (Array.isArray(value)) {
    const index = Number(head);
    const copy = [...value];
    copy[index] = tail.length === 0 ? next : updatePath(copy[index] ?? {}, tail, next);
    return copy;
  }
  const record = isRecord(value) ? value : {};
  if (tail.length === 0) return { ...record, [head]: next };
  return { ...record, [head]: updatePath(record[head] ?? {}, tail, next) };
}

function readPath(value: Record<string, unknown>, path: string[]) {
  return path.reduce<unknown>((current, key) => isRecord(current) ? current[key] : undefined, value);
}

export default function DeveloperDashboard() {
  const [active, setActive] = useState<DeveloperConfigSection>("home");
  const [data, setData] = useState<Partial<Record<DeveloperConfigSection, ApiSection>>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = data[active];
  const section = useMemo(() => SECTIONS.find((item) => item.id === active)!, [active]);

  // The immersive experience routes can leave an inline viewport lock behind.
  // This editor is deliberately document-height and must always be scrollable.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlHeight: html.style.height,
      htmlOverflowY: html.style.overflowY,
      bodyHeight: body.style.height,
      bodyMinHeight: body.style.minHeight,
      bodyOverflow: body.style.overflow,
      bodyOverflowY: body.style.overflowY,
    };

    html.style.height = "auto";
    html.style.overflowY = "auto";
    body.style.height = "auto";
    body.style.minHeight = "100%";
    body.style.overflow = "visible";
    body.style.overflowY = "auto";

    return () => {
      html.style.height = previous.htmlHeight;
      html.style.overflowY = previous.htmlOverflowY;
      body.style.height = previous.bodyHeight;
      body.style.minHeight = previous.bodyMinHeight;
      body.style.overflow = previous.bodyOverflow;
      body.style.overflowY = previous.bodyOverflowY;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(SECTIONS.map(async ({ id }) => {
      const response = await fetch(`/api/developer/config/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load ${id}.`);
      return [id, await response.json()] as const;
    }))
      .then((entries) => {
        if (!cancelled) setData(Object.fromEntries(entries));
      })
      .catch((error: unknown) => !cancelled && setMessage(error instanceof Error ? error.message : "Could not load configuration."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const setConfig = (config: Record<string, unknown>) => {
    setData((previous) => ({ ...previous, [active]: { config, revision: current?.revision ?? 0, updatedAt: current?.updatedAt ?? null } }));
  };

  const updateField = (path: string[], value: unknown) => {
    if (!current) return;
    setConfig(updatePath(current.config, path, value) as Record<string, unknown>);
  };

  const save = async () => {
    if (!current) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/developer/config/${active}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: current.config }),
      });
      const body = await response.json() as ApiSection & { message?: string };
      if (!response.ok) throw new Error(body.message ?? "Could not save draft.");
      setData((previous) => ({ ...previous, [active]: body }));
      setMessage(`${section.label} draft saved. Publish when you are ready.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save draft.");
    } finally { setBusy(false); }
  };

  const publish = async () => {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/developer/publish", { method: "POST" });
      const body = await response.json() as { message?: string; issues?: string[]; version?: number };
      if (!response.ok) throw new Error(body.issues?.join(" ") || body.message || "Publishing failed.");
      setMessage(`Published runtime configuration (version ${body.version}). The public pages will refresh from MongoDB.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publishing failed.");
    } finally { setBusy(false); }
  };

  const importJson = (event: ChangeEvent<HTMLInputElement>, path: string[]) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (path.length === 0) setConfig(isRecord(parsed) ? parsed : current?.config ?? {});
        else updateField(path, parsed);
        setMessage(`${file.name} loaded locally. Save the draft to store it in MongoDB.`);
      } catch { setMessage("That file is not valid JSON."); }
    };
    reader.readAsText(file);
  };

  if (loading) return <main className="min-h-screen bg-[#f5f3ee] p-8 text-[#171716]">Loading developer configuration…</main>;

  return (
    <main className="min-h-screen bg-[#f5f3ee] px-5 py-6 text-[#171716] sm:px-10 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-black/20 pb-6">
          <p className="text-xs uppercase tracking-[0.24em] text-black/55">Trifecta / Developer tools</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div><h1 className="font-serif text-4xl sm:text-5xl">Experience configuration</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-black/65">One global configuration for this codebase. Put media in the existing R2 bucket, then enter relative R2 keys here. JSON imports are parsed and stored in MongoDB; media is never uploaded through this page.</p></div>
            <button disabled={busy} onClick={publish} className="border border-[#171716] bg-[#171716] px-5 py-3 text-sm text-white disabled:opacity-50">{busy ? "Working…" : "Publish all drafts"}</button>
          </div>
          <p className="mt-5 border-l-2 border-red-700 bg-red-50 px-3 py-2 text-xs leading-5 text-red-900">Security notice: this route and its APIs are intentionally unauthenticated for local/private setup only. Do not expose <code>/developer</code> publicly until authentication is added.</p>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[245px_minmax(0,1fr)]">
          <nav className="space-y-1">{SECTIONS.map((item) => <button key={item.id} onClick={() => setActive(item.id)} className={`block w-full border-l-2 px-4 py-3 text-left transition ${active === item.id ? "border-[#171716] bg-black/5" : "border-transparent hover:bg-black/5"}`}><span className="block font-medium">{item.label}</span><span className="mt-1 block text-xs leading-4 text-black/55">{item.description}</span></button>)}</nav>
          <section className="min-w-0 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain border border-black/15 bg-white p-5 [scrollbar-gutter:stable] sm:p-8">
            <div className="flex flex-col gap-3 border-b border-black/15 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-serif text-3xl">{section.label}</h2><p className="mt-1 text-sm text-black/60">{section.description}</p></div><p className="text-xs text-black/50">Draft revision {current?.revision ?? 0}{current?.updatedAt ? ` · ${new Date(current.updatedAt).toLocaleString()}` : " · defaults not saved yet"}</p></div>
            {current && <ConfigForm section={active} config={current.config} updateField={updateField} importJson={importJson} />}
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-black/15 pt-5"><button disabled={busy || !current} onClick={save} className="border border-[#171716] px-5 py-3 text-sm disabled:opacity-50">{busy ? "Working…" : `Save ${section.label} draft`}</button>{message && <p className="text-sm text-black/70">{message}</p>}</div>
          </section>
        </div>
      </div>
    </main>
  );
}

function TextFields({ config, fields, updateField }: { config: Record<string, unknown>; fields: string[]; updateField: (path: string[], value: unknown) => void }) {
  return <div className="mt-6 grid gap-4 md:grid-cols-2">{fields.map((field) => <label key={field} className="block"><span className="mb-1.5 block text-xs uppercase tracking-wider text-black/55">{fieldLabel(field)}</span><input value={String(config[field] ?? "")} onChange={(event) => updateField([field], field.endsWith("Key") ? normalizeR2KeyInput(event.target.value) : event.target.value)} className="w-full border border-black/20 px-3 py-2.5 text-sm outline-none focus:border-black" /></label>)}</div>;
}

function JsonImport({ label, value, onImport }: { label: string; value: unknown; onImport: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="mt-6 border border-dashed border-black/25 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">{label}</p><p className="mt-1 text-xs text-black/55">{Array.isArray(value) ? `${value.length} records loaded` : "Import a JSON file"}. Media remains in R2.</p></div><label className="cursor-pointer border border-black/25 px-3 py-2 text-xs hover:bg-black/5">Choose JSON<input type="file" accept="application/json,.json" className="hidden" onChange={onImport} /></label></div></div>;
}

function ConfigForm({ section, config, updateField, importJson }: { section: DeveloperConfigSection; config: Record<string, unknown>; updateField: (path: string[], value: unknown) => void; importJson: (event: ChangeEvent<HTMLInputElement>, path: string[]) => void }) {
  if (section === "home") return <TextFields config={config} fields={HOME_FIELDS} updateField={updateField} />;
  if (section === "fallback-assets") return <TextFields config={config} fields={FALLBACK_FIELDS} updateField={updateField} />;
  if (section === "interior") return <><TextFields config={config} fields={INTERIOR_FIELDS} updateField={updateField} /><JsonImport label="Furnished node tracking JSON" value={config.furnishedNodes} onImport={(event) => importJson(event, ["furnishedNodes"])} /><JsonImport label="Bare-shell node tracking JSON" value={config.bareShellNodes} onImport={(event) => importJson(event, ["bareShellNodes"])} /></>;
  if (section === "exterior") return <><TextFields config={config} fields={EXTERIOR_FIELDS} updateField={updateField} /><JsonImport label="Exterior node tracking JSON" value={config.nodes} onImport={(event) => importJson(event, ["nodes"])} /></>;
  if (section === "amenities") return <><JsonImport label="Amenities page JSON" value={readPath(config, ["pageData", "items"])} onImport={(event) => importJson(event, ["pageData"])} /><JsonImport label="Exterior amenity markers JSON" value={config.exteriorAmenities} onImport={(event) => importJson(event, ["exteriorAmenities"])} /></>;
  return <MasterPlanForm config={config} updateField={updateField} importJson={importJson} />;
}

function MasterPlanForm({ config, updateField, importJson }: { config: Record<string, unknown>; updateField: (path: string[], value: unknown) => void; importJson: (event: ChangeEvent<HTMLInputElement>, path: string[]) => void }) {
  const hotspots = Array.isArray(config.hotspots) ? config.hotspots : [];
  return <div className="mt-6 space-y-7"><div className="grid gap-4 md:grid-cols-4"><label><span className="mb-1.5 block text-xs uppercase tracking-wider text-black/55">Renderer</span><select value={String(config.renderer ?? "unreal")} onChange={(event) => updateField(["renderer"], event.target.value)} className="w-full border border-black/20 bg-white px-3 py-2.5 text-sm"><option value="unreal">Unreal Engine</option><option value="3ds-max-vantage">3ds Max + Chaos Vantage</option></select></label>{["totalFrames", "fps", "aspectRatio"].map((field) => <label key={field}><span className="mb-1.5 block text-xs uppercase tracking-wider text-black/55">{fieldLabel(field)}</span><input type="number" step="any" value={String(config[field] ?? "")} onChange={(event) => updateField([field], Number(event.target.value))} className="w-full border border-black/20 px-3 py-2.5 text-sm" /></label>)}</div><TextFields config={config} fields={MASTER_ASSET_FIELDS} updateField={updateField} /><div><h3 className="font-serif text-2xl">A1–A4 camera hotspots</h3><p className="mt-1 text-sm text-black/60">Camera positions use the same world space as the GLB. Quaternions are <code>[x, y, z, w]</code>.</p><div className="mt-4 overflow-x-auto border border-black/15"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-black/[.03] uppercase tracking-wider text-black/55"><tr><th className="p-3">Point</th><th className="p-3">Frame</th><th className="p-3">Position x / y / z</th><th className="p-3">Quaternion x / y / z / w</th><th className="p-3">FOV</th></tr></thead><tbody>{hotspots.map((hotspot, index) => { const item = isRecord(hotspot) ? hotspot : {}; const camera = isRecord(item.camera) ? item.camera : {}; const position = isRecord(camera.position) ? camera.position : {}; const quaternion = Array.isArray(camera.quaternion) ? camera.quaternion : []; return <tr key={String(item.key ?? index)} className="border-t border-black/10"><td className="p-3 font-medium">{String(item.key ?? `A${index + 1}`)}</td><td className="p-3"><input type="number" value={String(item.frame ?? "")} onChange={(event) => updateField(["hotspots", String(index), "frame"], Number(event.target.value))} className="w-16 border border-black/20 p-1.5" /></td><td className="p-3">{["x", "y", "z"].map((key) => <input key={key} type="number" step="any" value={String(position[key] ?? "")} onChange={(event) => updateField(["hotspots", String(index), "camera", "position", key], Number(event.target.value))} className="mr-1 w-16 border border-black/20 p-1.5" />)}</td><td className="p-3">{[0, 1, 2, 3].map((part) => <input key={part} type="number" step="any" value={String(quaternion[part] ?? "")} onChange={(event) => { const next = [...quaternion]; next[part] = Number(event.target.value); updateField(["hotspots", String(index), "camera", "quaternion"], next); }} className="mr-1 w-16 border border-black/20 p-1.5" />)}</td><td className="p-3"><input type="number" step="any" value={String(camera.fov ?? "")} onChange={(event) => updateField(["hotspots", String(index), "camera", "fov"], Number(event.target.value))} className="w-16 border border-black/20 p-1.5" /></td></tr>; })}</tbody></table></div></div><JsonImport label="Full master-plan configuration JSON (optional bulk import)" value={config.hotspots} onImport={(event) => importJson(event, [])} /><details className="border border-black/15 p-4"><summary className="cursor-pointer text-sm font-medium">Tower footprint anchors and transform JSON</summary><p className="mt-2 text-xs leading-5 text-black/60">This contains the four GLB footprint dummies for each tower and the calculated model transform. Import only trusted generated data. The runtime validates the A1–A4 cameras and dummy points when publishing.</p><textarea value={JSON.stringify({ towerAWorldDummies: config.towerAWorldDummies, towerBWorldDummies: config.towerBWorldDummies, towerATransform: config.towerATransform, towerBTransform: config.towerBTransform, towerACameras: config.towerACameras, towerBCameras: config.towerBCameras }, null, 2)} onChange={(event) => { try { const next = JSON.parse(event.target.value) as Record<string, unknown>; Object.entries(next).forEach(([key, value]) => updateField([key], value)); } catch { /* allow user to finish typing valid JSON */ } }} className="mt-3 min-h-80 w-full border border-black/20 p-3 font-mono text-xs" /></details></div>;
}
