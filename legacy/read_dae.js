// fetch("./resources/mailbox slot.dae")
//   .then((res) => res.text()) // 或 .then(res => res.xml() 用 DOMParser)
//   .then((xmlString) => {
//     const parser = new DOMParser();
//     const xmlDoc = parser.parseFromString(xmlString, "text/xml");
//     console.log(xmlDoc.querySelector("geometry"));

//     const geometries = xmlDoc.querySelectorAll("geometry");
//     geometries.forEach((geometry) => {
//       const id = geometry.getAttribute("id");
//       console.log("Geometry ID:", id);

//       const sources = geometry.querySelectorAll("source");
//       sources.forEach((source) => {
//         const floatArray = source.querySelector("float_array");
//         if (floatArray) {
//           const id = floatArray.getAttribute("id");
//           const data = floatArray.textContent.trim().split(/\s+/).map(Number);
//           console.log("Source:", id, data.slice(0, 9)); // 只打印前3个点方便查看
//         }
//       });
//     });

//     const triangles = xmlDoc.querySelectorAll("triangles");
//     triangles.forEach((tri) => {
//       const material = tri.getAttribute("material");
//       const indices = tri
//         .querySelector("p")
//         ?.textContent.trim()
//         .split(/\s+/)
//         .map(Number);
//       console.log("Material:", material, "Indices:", indices?.slice(0, 9));
//     });

//     const effects = xmlDoc.querySelectorAll("effect");
//     effects.forEach((effect) => {
//       const id = effect.getAttribute("id");
//       const color = effect.querySelector("color")?.textContent.trim();
//       console.log("Effect ID:", id, "Color:", color);
//     });
//   });

export async function geometryData(path) {
  let res, xmlString, parser, xmlDoc

  res = await fetch(path)
  xmlString = await res.text()
  parser = new DOMParser()
  xmlDoc = parser.parseFromString(xmlString, `text/xml`)

  let geometries, positions, indices
  geometries = xmlDoc.querySelectorAll(`geometry`)
  geometries.forEach((geometry) => {
    let id = geometry.getAttribute(`id`)
    // *simplify
    if (id == `ID4`) {
      let positionSource, floatArray

      positionSource = geometry.querySelectorAll(`source`)
      positionSource.forEach((source) => {
        floatArray = source.querySelector(`float_array`)
        if (floatArray) {
          id = floatArray.getAttribute(`id`)
          // *simplify
          if (id == `ID15`) {
            positions = floatArray.textContent.trim().split(/\s+/).map(Number)
          }
        }
      })

      let indiceSourceBrothers, indiceSource

      indiceSourceBrothers = geometry.querySelectorAll(`input`)
      indiceSourceBrothers.forEach((indiceSourceBrother) => {
        indiceSource = indiceSourceBrother.nextElementSibling
        if (indiceSource) {
          let source = indiceSourceBrother.getAttribute(`source`)
          // *simplify
          if (source == `#ID10`) {
            indices = indiceSource.textContent.trim().split(/\s+/).map(Number)
          }
        }
      })
    }
  })

  console.log(`GET geometryData success!`)

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  }
}