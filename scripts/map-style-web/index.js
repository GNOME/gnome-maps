"use strict";

import TinySDF from "./tiny-sdf.js";

document.title = "Map Style Preview";

const mapContainer = document.getElementById("mapContainer");

async function loadMap() {
  const iconsJson = fetch("./icons.json").then((res) => res.json());
  let mapStyle = "./gnome-maps-light.json";

  const map = (window.map = new maplibregl.Map({
    container: mapContainer,
    style: mapStyle,
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
    const setMapStyle = () => {
      mapStyle = `./${variantBtn.dataset.variant}.json`;
      map.setStyle(mapStyle);
    };
    variantBtn.addEventListener("change", setMapStyle);
    if (variantBtn.checked) {
      setMapStyle();
    }
  }

  window.mapStyleReload = () => {
    map.setStyle(mapStyle);
  };
}

loadMap();
