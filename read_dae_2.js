import { cal_item_size, cal_item_center } from "./tools/calculate.js";
import { mat3, mat4, vec3 } from "./node_modules/gl-matrix/esm/index.js";

const walkNode = (node, nodeMap, geometryMap, geometries, normalTransform, parentWorldMatrix = mat4.create()) => {
  console.log(`nodeID: ${node.getAttribute(`id`)} nodeName: ${node.getAttribute(`name`)}`)
  let localMatrix, matrix, worldMatrix, instanceGeometry

  localMatrix = mat4.create()

  matrix = node.querySelector(`:scope > matrix`)

  if (matrix) {
    let values
    values = matrix.textContent.trim().split(/\s+/).map(Number)
    localMatrix = mat4.fromValues(...values)
    mat4.transpose(localMatrix, localMatrix)
  }

  worldMatrix = mat4.create()
  mat4.multiply(worldMatrix, parentWorldMatrix, localMatrix)
  console.log(`worldMatrix:`, worldMatrix, `parentWorldMatrix:`, parentWorldMatrix, `localMatrix:`, localMatrix)

  // === node ===
  let children = node.querySelectorAll(`:scope > node`)
  children.forEach(child => {
    walkNode(child, nodeMap, geometryMap, geometries, normalTransform, worldMatrix)
  })

  // === instance_node ===
  let instanceNode
  instanceNode = node.querySelector(`:scope > instance_node`)
  if (instanceNode) {
    console.log(`instanceNodeID: ${instanceNode.getAttribute(`url`)}`)
    let referenceID, reference
    referenceID = instanceNode.getAttribute(`url`).replace(`#`, ``)
    reference = nodeMap.get(referenceID)
    if (reference) {
      walkNode(reference, nodeMap, geometryMap, geometries, normalTransform, worldMatrix)
    }
  }

  // === instance_geometry ===
  instanceGeometry = node.querySelector(`:scope > instance_geometry`)
  if (instanceGeometry) {
    console.log(`instanceGeometryURL: ${instanceGeometry.getAttribute(`url`)}`)
    let geometryID, geometry

    geometryID = instanceGeometry.getAttribute(`url`).replace(/^#/, ``)
    geometry = geometryMap.get(geometryID)
    if (geometry) {
      console.log(`geometryMap.has? ${geometryMap.has(geometryID)} geometryID: ${geometryID} geometry: ${geometry}`)
      let data,
        positions, normals, indices, vertices,
        positionID, position,
        normalID, normal,
        floatArray

      data = {}
      positions = []
      normals = []
      indices = []

      vertices = geometry.querySelector(`vertices`)
      // === Get positions ===
      positionID = vertices.querySelector(`input[semantic="POSITION"]`).getAttribute(`source`).replace(`#`, ``)

      if (positionID) {
        position = geometry.querySelector(`source[id="${positionID}"]`)
      }

      if (position) {
        floatArray = position.querySelector(`float_array`)
      }

      if (floatArray) {
        data.positions = floatArray.textContent.trim().split(/\s+/).map(Number)

        let position, position_old
        for (let i = 0; i < data.positions.length; i += 3) {
          position = vec3.fromValues(
            data.positions[i],
            data.positions[i + 1],
            data.positions[i + 2],
          )
          position_old = vec3.clone(position)
          vec3.transformMat4(position, position, worldMatrix)
          // console.log(`position_old:`, position_old, `position:`, position)
          positions.push(...position)

          // console.log("vec3.transformMat4.toString():", vec3.transformMat4.toString())
          // let test = vec3.transformMat4(vec3.create(), position_old, worldMatrix)
          // console.log("position_old:", position_old)
          // console.log("worldMatrix:", worldMatrix)
          // console.log("transformed:", test)
        }
      }

      // === Get normals ===
      normalID = vertices.querySelector(`input[semantic="NORMAL"]`).getAttribute(`source`).replace(`#`, ``)

      if (normalID) {
        normal = geometry.querySelector(`source[id="${normalID}"]`)
      }

      if (normal) {
        floatArray = normal.querySelector(`float_array`)
      }

      if (floatArray) {
        data.normals = floatArray.textContent.trim().split(/\s+/).map(Number)

        // console.log("raw float_array sample:", data.positions.slice(0, 9)) // 原始值

        let normal
        for (let i = 0; i < data.normals.length; i += 3) {
          normal = vec3.fromValues(
            data.normals[i],
            data.normals[i + 1],
            data.normals[i + 2],
          )
          let normalMat4 = mat4.clone(worldMatrix)
          mat4.invert(normalMat4, normalMat4)
          mat4.transpose(normalMat4, normalMat4)
          let localNormalMatrix = mat3.create()
          mat3.fromMat4(localNormalMatrix, normalMat4)
          vec3.transformMat3(normal, normal, localNormalMatrix)
          // vec3.transformMat3(normal, normal, normalTransform)
          vec3.normalize(normal, normal)
          normals.push(...normal)
        }

        // console.log("transformed sample:", positions.slice(0, 9))
      }

      // === Get indices ===
      let triangles
      triangles = geometry.querySelectorAll(`triangles`)
      triangles.forEach((triangle) => {
        let input, p, data
        input = triangle.querySelector(`input[semantic="VERTEX"]`)
        if (input?.getAttribute(`offset`) != `0`) return
        p = triangle.querySelector(`p`)
        data = p.textContent.trim().split(/\s+/).map(Number)
        indices.push(...data)
      })

      geometries.push({
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: new Uint32Array(indices),
        name: geometry.getAttribute(`id`),
      })
    }
  }
}

export async function geometryData(path) {
  let data,
    res, xmlString, parser, xmlDoc, roots,
    nodes, nodeMap, node_unit, unit, scale,
    geometries, geometryMap,
    ZupToYup, fixRotation, fullRotation, normalTransform,
    positions

  data = {}
  res = await fetch(path)
  xmlString = await res.text()
  parser = new DOMParser()
  xmlDoc = parser.parseFromString(xmlString, `text/xml`)
  roots = xmlDoc.querySelector(`visual_scene > node`)
  roots = roots.querySelectorAll(`:scope > node:not([name^="skp_camera"])`)

  nodes = xmlDoc.querySelectorAll(`library_nodes > node`)
  nodeMap = new Map()
  nodes.forEach((node) => {
    nodeMap.set(node.getAttribute(`id`), node)
  })

  node_unit = xmlDoc.querySelector(`asset > unit`)
  unit = node_unit ? parseFloat(node_unit.getAttribute(`meter`)) : 1.0
  scale = mat4.create()
  mat4.fromScaling(scale, [1 / unit, 1 / unit, 1 / unit])

  geometries = xmlDoc.querySelectorAll(`library_geometries > geometry`)
  geometryMap = new Map()
  geometries.forEach((geometry) => {
    geometryMap.set(geometry.getAttribute(`id`), geometry)
  })
  console.log("geometryMap keys:", [...geometryMap.keys()])

  data.geometries = []

  ZupToYup = mat4.create()
  fixRotation = mat4.create()
  fullRotation = mat4.create()
  normalTransform = mat3.create()

  mat4.fromXRotation(ZupToYup, -Math.PI / 2)
  console.log(`ZupToYup:`, ZupToYup)
  mat4.fromYRotation(fixRotation, Math.PI / 2)
  console.log(`fixRotation:`, fixRotation)
  mat4.multiply(fullRotation, fixRotation, ZupToYup)
  console.log(`fullRotation:`, fullRotation)
  mat3.fromMat4(normalTransform, fullRotation)
  console.log(`normalTransform:`, normalTransform)

  roots.forEach((root) => {
    walkNode(root, nodeMap, geometryMap, data.geometries, normalTransform, fullRotation)
  })

  positions = data.geometries.flatMap(items => Array.from(items.positions))

  let size, center
  {
    size = await cal_item_size(positions)
    center = await cal_item_center(positions)
    // size = 1
    // center = [0, 0, 0]
  }

  console.log(`GET geometryData success!`)

  return {
    meshes: data.geometries,
    size: size,
    center: center,
  }
}

// export async function geometryData(path) {
//   let res, xmlString, parser, xmlDoc

//   res = await fetch(path)
//   xmlString = await res.text()
//   parser = new DOMParser()
//   xmlDoc = parser.parseFromString(xmlString, `text/xml`)

//   let geometries,
//     ZupToYup, fixRotation, fullRotation, normalTransform

//   geometries = xmlDoc.querySelectorAll(`geometry`)
//   ZupToYup = mat4.create()
//   fixRotation = mat4.create()
//   fullRotation = mat4.create()
//   normalTransform = mat3.create()

//   mat4.fromXRotation(ZupToYup, -Math.PI / 2)
//   mat4.fromYRotation(fixRotation, Math.PI / 2)
//   mat4.multiply(fullRotation, fixRotation, ZupToYup)
//   mat3.fromMat4(normalTransform, fullRotation)

//   let data_geometries, positions, normals, indices

//   data_geometries = []

//   geometries.forEach((geometry) => {
//     let vertices, normalDir,
//       positionSourceId, positionSource,
//       normalSourceId, normalSource,
//       floatArray

//     vertices = geometry.querySelector(`vertices input[semantic="POSITION"]`)
//     normalDir = geometry.querySelector(`vertices input[semantic="NORMAL"]`)

//     if (vertices) {
//       positionSourceId = vertices.getAttribute(`source`).replace(/^#/, ``)
//       positionSource = geometry.querySelector(`source[id="${positionSourceId}"]`)
//     }

//     if (positionSource) {
//       floatArray = positionSource.querySelector(`float_array`)
//     }

//     if (floatArray) {
//       let rawPositions
//       rawPositions = floatArray.textContent.trim().split(/\s+/).map(Number)
//       positions = []

//       for (let i = 0; i < rawPositions.length; i += 3) {
//         let p = vec3.fromValues(
//           rawPositions[i],
//           rawPositions[i + 1],
//           rawPositions[i + 2]
//         )
//         vec3.transformMat4(p, p, fullRotation)
//         positions.push(...p)
//       }
//     }

//     indices = []
//     let triangles = geometry.querySelectorAll(`triangles`)
//     triangles.forEach((tri) => {
//       let input = tri.querySelector(`input[semantic="VERTEX"]`)

//       if (input?.getAttribute(`offset`) != `0`) return

//       let p = tri.querySelector(`p`)

//       if (p) {
//         let data = p.textContent.trim().split(/\s+/).map(Number)

//         indices.push(...data)
//       }
//     })

//     if (normalDir) {
//       normalSourceId = normalDir.getAttribute(`source`).replace(/^#/, ``)
//       normalSource = geometry.querySelector(`source[id="${normalSourceId}"]`)
//     }

//     if (normalSource) {
//       floatArray = normalSource.querySelector(`float_array`)
//     }

//     let rawNormals
//     if (floatArray) {
//       rawNormals = floatArray.textContent.trim().split(/\s+/).map(Number)
//       normals = []

//       for (let i = 0; i < rawNormals.length; i += 3) {
//         let n = vec3.fromValues(
//           rawNormals[i],
//           rawNormals[i + 1],
//           rawNormals[i + 2]
//         )
//         vec3.transformMat3(n, n, normalTransform)
//         vec3.normalize(n, n)
//         normals.push(...n)
//       }
//     }

//     data_geometries.push({
//       positions: new Float32Array(positions),
//       normals: new Float32Array(normals),
//       indices: new Uint32Array(indices),
//       name: geometry.getAttribute(`id`),
//     })
//   })


//   let size
//   {
//     size = await cal_item_size(positions)
//   }

//   let center
//   {
//     positions = data_geometries.flatMap(items => Array.from(items.positions))
//     center = await cal_item_center(positions)
//   }


//   console.log(`GET geometryData success!`)

//   return {
//     meshes: data_geometries,
//     size: size,
//     center: center,
//   }
// }