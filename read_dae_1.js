export async function geometryData(path) {
  let res, xmlString, parser, xmlDoc

  res = await fetch(path)
  xmlString = await res.text()
  parser = new DOMParser()
  xmlDoc = parser.parseFromString(xmlString, `text/xml`)

  let geometries, data_geometries, positions, indices
  geometries = xmlDoc.querySelectorAll(`geometry`)

  data_geometries = []

  geometries.forEach((geometry) => {
    let vertices, positionSourceId, positionSource, floatArray

    vertices = geometry.querySelector(`vertices input[semantic="POSITION"]`)

    if (vertices) {
      positionSourceId = vertices.getAttribute("source").replace(/^#/, ``)
      positionSource = geometry.querySelector(`source[id="${positionSourceId}"]`)
    }

    if (positionSource) {
      floatArray = positionSource.querySelector(`float_array`)
    }

    if (floatArray) {
      positions = floatArray.textContent.trim().split(/\s+/).map(Number)
    }

    indices = []
    let triangles = geometry.querySelectorAll(`triangles`)
    triangles.forEach((tri) => {
      let input = tri.querySelector(`input[semantic="VERTEX"]`)

      if (input?.getAttribute(`offset`) != `0`) return

      let p = tri.querySelector(`p`)

      if (p) {
        let data = p.textContent.trim().split(/\s+/).map(Number)

        indices.push(...data)
      }
    })

    data_geometries.push({
      positions: new Float32Array(positions),
      indices: new Uint32Array(indices),
      name: geometry.getAttribute(`id`),
    })
  })

  console.log(`GET geometryData success!`)

  return data_geometries
}