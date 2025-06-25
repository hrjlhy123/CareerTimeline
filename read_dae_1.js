import { cal_item_size, cal_item_center } from "./tools/calculate.js";
import { mat3, mat4, vec3 } from "./node_modules/gl-matrix/esm/index.js";

export async function geometryData(path) {
  let res, xmlString, parser, xmlDoc

  res = await fetch(path)
  xmlString = await res.text()
  parser = new DOMParser()
  xmlDoc = parser.parseFromString(xmlString, `text/xml`)

  let geometries, 
      ZupToYup, fixRotation, fullRotation, normalTransform

  geometries = xmlDoc.querySelectorAll(`geometry`)
  ZupToYup = mat4.create()
  fixRotation = mat4.create()
  fullRotation = mat4.create()
  normalTransform = mat3.create()

  mat4.fromXRotation(ZupToYup, -Math.PI / 2)
  mat4.fromYRotation(fixRotation, Math.PI / 2)
  mat4.multiply(fullRotation, fixRotation, ZupToYup)
  mat3.fromMat4(normalTransform, fullRotation)

  let data_geometries, positions, normals, indices

  data_geometries = []
  
  geometries.forEach((geometry) => {
    let vertices, normalDir,
      positionSourceId, positionSource,
      normalSourceId, normalSource,
      floatArray

    vertices = geometry.querySelector(`vertices input[semantic="POSITION"]`)
    normalDir = geometry.querySelector(`vertices input[semantic="NORMAL"]`)

    if (vertices) {
      positionSourceId = vertices.getAttribute(`source`).replace(/^#/, ``)
      positionSource = geometry.querySelector(`source[id="${positionSourceId}"]`)
    }

    if (positionSource) {
      floatArray = positionSource.querySelector(`float_array`)
    }

    let rawPositions
    if (floatArray) {
      rawPositions = floatArray.textContent.trim().split(/\s+/).map(Number)
      positions = []

      for (let i = 0; i < rawPositions.length; i += 3) {
        let p = vec3.fromValues(
          rawPositions[i],
          rawPositions[i + 1],
          rawPositions[i + 2]
        )
        vec3.transformMat4(p, p, fullRotation)
        positions.push(...p)
      }
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

    if (normalDir) {
      normalSourceId = normalDir.getAttribute(`source`).replace(/^#/, ``)
      normalSource = geometry.querySelector(`source[id="${normalSourceId}"]`)
    }

    if (normalSource) {
      floatArray = normalSource.querySelector(`float_array`)
    }

    let rawNormals
    if (floatArray) {
      rawNormals = floatArray.textContent.trim().split(/\s+/).map(Number)
      normals = []

      for (let i = 0; i < rawNormals.length; i += 3) {
        let n = vec3.fromValues(
          rawNormals[i],
          rawNormals[i + 1],
          rawNormals[i + 2]
        )
        vec3.transformMat3(n, n, normalTransform)
        vec3.normalize(n, n)
        normals.push(...n)
      }
    }

    data_geometries.push({
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices),
      name: geometry.getAttribute(`id`),
    })
  })


  let size
  {
    size = await cal_item_size(positions)
  }

  let center
  {
    positions = data_geometries.flatMap(items => Array.from(items.positions))
    center = await cal_item_center(positions)
  }


  console.log(`GET geometryData success!`)

  return {
    meshes: data_geometries,
    size: size,
    center: center,
  }
}