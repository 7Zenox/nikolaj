// components/combinedVisualization.tsx

import React from "react";
import { DataRow } from "../types";
import { getMin, getMax } from "./utils";

export interface ScatterMapboxTrace {
  type: "scattermapbox";
  mode: string;
  lat: number[];
  lon: number[];
  marker: { size: number; color: string; opacity?: number };
  name: string;
  showlegend?: boolean;
  line?: { width: number; color: string };
}

// ————————————————
// Heatmap generator (unchanged)
// ————————————————
export function genHeatMapHTML(data: DataRow[]): string {
  const valid = data.filter(
    (r) =>
      r.Latitude !== undefined &&
      r.Longitude !== undefined &&
      !isNaN(Number(r.Latitude)) &&
      !isNaN(Number(r.Longitude))
  );
  const lat = valid.map((r) => Number(r.Latitude));
  const lon = valid.map((r) => Number(r.Longitude));
  const z = valid.map((r) => r.type || 0);
  const colorscale = [
    [0, "red"],
    [0.2, "orange"],
    [0.4, "yellow"],
    [0.6, "green"],
    [0.8, "cyan"],
    [1, "darkblue"],
  ];
  const centerLat = lat.length ? (getMin(lat) + getMax(lat)) / 2 : 0;
  const centerLon = lon.length ? (getMin(lon) + getMax(lon)) / 2 : 0;

  return `
<!DOCTYPE html>
<html>
  <head>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
      body, html, #heatmap { width:100%; height:100%; margin:0; padding:0; }
    </style>
  </head>
  <body>
    <div id="heatmap"></div>
    <script>
      Plotly.newPlot(
        'heatmap',
        [{ type:'densitymapbox', lat:${JSON.stringify(lat)}, lon:${JSON.stringify(lon)}, z:${JSON.stringify(z)}, radius:3, colorscale:${JSON.stringify(colorscale)} }],
        { margin:{l:0,t:0,b:0,r:0}, mapbox:{ style:"carto-darkmatter", center:{lat:${centerLat},lon:${centerLon}},zoom:10 }, autosize:true },
        { responsive:true }
      );
      window.addEventListener('resize',()=>Plotly.Plots.resize(document.getElementById('heatmap')));
    </script>
  </body>
</html>
`;
}

// —————————————————————————————————————————————————————————————————————————————————————————————
// Clusters + approximate silhouette (O(n·k) in a Web Worker)
// —————————————————————————————————————————————————————————————————————————————————————————————
export async function genClustersHTML(
  data: DataRow[],
  n: number
): Promise<string> {
  // 1) Primary k‑means + extract centroids
  const { kmeansGenerator } = await import("ml-kmeans");
  const features: [number, number][] = data
    .filter(
      (r) =>
        r.Latitude !== undefined &&
        r.Longitude !== undefined &&
        !isNaN(Number(r.Latitude)) &&
        !isNaN(Number(r.Longitude))
    )
    .map((r) => [Number(r.Latitude), Number(r.Longitude)]);

  const iter = kmeansGenerator(features, n, {}) as IterableIterator<{
    clusters: number[];
    centroids: Array<{ centroid: [number, number] } | [number, number]>;
  }>;
  let result = null;
  for (const it of iter) result = it;
  const labels = result!.clusters;
  // normalize centroids to [number,number][]
  const centroids: [number, number][] = result!.centroids.map((c) =>
    Array.isArray(c) ? c : (c.centroid as [number, number])
  );

  // 2) Build primary traces
  const unique = Array.from(new Set(labels));
  const palette = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ];
  const primaryTraces: ScatterMapboxTrace[] = unique.map((cid) => {
    const pts = data.filter((_, i) => labels[i] === cid);
    return {
      type: "scattermapbox",
      mode: "markers",
      lat: pts.map((r) => Number(r.Latitude)),
      lon: pts.map((r) => Number(r.Longitude)),
      marker: { size: 4, color: palette[cid % palette.length], opacity: 0.6 },
      name: `Cluster ${cid}`,
    };
  });

  // 3) Secondary boundaries (unchanged)
  const { analyze } = await import("./clustering");
  const sec = await analyze(data, n);
  const secondaryTraces: ScatterMapboxTrace[] = sec.longs.map(
    (lonPair, i) => ({
      type: "scattermapbox",
      mode: "lines+markers",
      lon: lonPair,
      lat: sec.lats[i],
      line: { width: 3, color: palette[i % palette.length] },
      marker: { size: 6, color: palette[i % palette.length] },
      showlegend: false,
      name: `Boundary ${i}`,
    })
  );

  const allTraces = primaryTraces.concat(secondaryTraces);
  const allLats = data.map((r) => Number(r.Latitude));
  const allLons = data.map((r) => Number(r.Longitude));
  const centerLat = allLats.length ? (getMin(allLats) + getMax(allLats)) / 2 : 0;
  const centerLon = allLons.length ? (getMin(allLons) + getMax(allLons)) / 2 : 0;

  // 4) Return HTML with an immediate map + Web Worker badge
  return `
<!DOCTYPE html>
<html>
  <head>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
      body, html, #map { width:100%; height:100%; margin:0; padding:0; }
      #sil-score {
        position:absolute; top:10px; left:10px;
        background:rgba(255,255,255,0.8);
        padding:6px 10px; border-radius:4px;
        font-family:sans-serif; font-size:14px; z-index:10;
      }
      .spinner {
        display:inline-block;
        width:14px; height:14px;
        border:2px solid rgba(0,0,0,0.1);
        border-left-color:#09f;
        border-radius:50%;
        animation:spin 1s linear infinite;
        vertical-align:middle;
      }
      @keyframes spin{to{transform:rotate(360deg);}}
    </style>
  </head>
  <body>
    <div id="sil-score"><span class="spinner"></span> Computing score…</div>
    <div id="map"></div>
    <script>
      // render map immediately
      Plotly.newPlot(
        'map',
        ${JSON.stringify(allTraces)},
        {
          margin:{l:0,t:0,b:0,r:0},
          mapbox:{style:"open-street-map",center:{lat:${centerLat},lon:${centerLon}},zoom:10},
          autosize:true, showlegend:false
        },
        { responsive:true }
      );

      // approximate silhouette in a Web Worker (O(n·k))
      const workerCode = \`
        self.onmessage = e => {
          const { features, labels, centroids } = e.data;
          function euclid(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
          const n = features.length, k = centroids.length;
          let sum=0;
          for(let i=0;i<n;i++){
            const f=features[i], L=labels[i];
            const a = euclid(f, centroids[L]);
            let b = Infinity;
            for(let c=0;c<k;c++) if(c!==L)
              b = Math.min(b, euclid(f, centroids[c]));
            sum += (b - a)/Math.max(a,b);
          }
          self.postMessage(sum/n);
        };
      \`;
      const blob = new Blob([workerCode], {type:'application/javascript'});
      const worker = new Worker(URL.createObjectURL(blob));

      worker.postMessage({
        features: ${JSON.stringify(features)},
        labels: ${JSON.stringify(labels)},
        centroids: ${JSON.stringify(centroids)}
      });
      worker.onmessage = e => {
        document.getElementById('sil-score').textContent =
          'Silhouette Score: ' + e.data.toFixed(2);
        worker.terminate();
      };
    </script>
  </body>
</html>
`;
}

// Pure React wrapper—no changes needed here
export default function CombinedVisualization({
  heatmapHtml,
  clustersHtml,
}: {
  heatmapHtml: string;
  clustersHtml: string;
}) {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ flex: 1, borderRight: "1px solid #ccc" }}>
        {clustersHtml ? (
          <iframe
            srcDoc={clustersHtml}
            style={{ width: "100%", height: "100%", border: 0 }}
            title="Patrol Plot"
          />
        ) : (
          <div>Patrol Plot not generated</div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        {heatmapHtml ? (
          <iframe
            srcDoc={heatmapHtml}
            style={{ width: "100%", height: "100%", border: 0 }}
            title="Heatmap"
          />
        ) : (
          <div>Heatmap not generated</div>
        )}
      </div>
    </div>
  );
}
