"use strict";

import TinySDF from "./tiny-sdf.js";

document.title = "Map Style Preview";

const mapContainer = document.getElementById("mapContainer");

async function loadMap() {
  const iconsJson = fetch("./icons.json").then((res) => res.json());

  const map = (window.map = new maplibregl.Map({
    container: mapContainer,
    style: "./gnome-maps-light.json",
    hash: true,
  }));

  map.on("styleimagemissing", async (event) => {
    if ((await iconsJson).includes(event.id + ".svg")) {
      const svg = await (await fetch(`icons/${event.id}.svg`)).text();

      const i = await new TinySDF().draw((ctx, buf) => {
        return new Promise((resolve) => {
          const image = new Image();
          image.onload = () => {
            ctx.drawImage(image, buf, buf);
            resolve();
          };
          image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
        });
      });

      if (!map.hasImage(event.id)) map.addImage(event.id, i, { sdf: true });
    }
  });

  map.on("styledata", (event) => {
    const style = map.getStyle();
    for (const layer of style.layers) {
      if (!layer.metadata) continue;
      const cursor = layer.metadata["libshumate:cursor"];

      if (cursor) {
        map.on("mouseenter", layer.id, (event) => {
          const features = map.queryRenderedFeatures(event.point);
          if (features.length > 0) {
            const canvas = mapContainer.querySelector(".maplibregl-canvas");
            canvas.style.cursor = cursor;
          }
        });

        map.on("mouseleave", layer.id, () => {
          const canvas = mapContainer.querySelector(".maplibregl-canvas");
          canvas.style.cursor = "grab";
        });
      }
    }
  });

  for (const variantBtn of document.querySelectorAll(".variant")) {
    variantBtn.addEventListener("change", () => {
      map.setStyle(`./${variantBtn.dataset.variant}.json`);
    });
    if (variantBtn.checked) {
      variantBtn.dispatchEvent(new Event("change"));
    }
  }
}

loadMap();
