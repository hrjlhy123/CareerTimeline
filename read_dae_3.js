import { collect_positions } from "./tools/collect.js"
import { cal_item_size, cal_item_center } from "./tools/calculate.js";
import { mat3, mat4, vec3 } from "./node_modules/gl-matrix/esm/index.js";

const walkNode = async (node, nodeMap, geometryMap, geometries, normalTransform, parentWorldMatrix = mat4.create(), granularity = `geometry`) => {
  // console.log(`nodeID: ${node.getAttribute(`id`)} nodeName: ${node.getAttribute(`name`)}`)
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
  // console.log(`worldMatrix:`, worldMatrix, `parentWorldMatrix:`, parentWorldMatrix, `localMatrix:`, localMatrix)

  // === node ===
  let children = node.querySelectorAll(`:scope > node`)
  for (const child of children) {
    await walkNode(child, nodeMap, geometryMap, geometries, normalTransform, worldMatrix, `instanceNode`)
  }
  // children.forEach(child => {
  //   walkNode(child, nodeMap, geometryMap, geometries, normalTransform, worldMatrix, `instanceNode`)
  // })

  // === instance_node ===
  let instanceNode
  instanceNode = node.querySelector(`:scope > instance_node`)
  if (instanceNode) {
    // console.log(`instanceNodeID: ${instanceNode.getAttribute(`url`)}`)
    let referenceID, reference
    referenceID = instanceNode.getAttribute(`url`).replace(`#`, ``)
    reference = nodeMap.get(referenceID)
    if (reference) {
      // === instanceNode level ===
      if (granularity == `instanceNode`) {
        let groundGeometries
        groundGeometries = []
        await walkNode(reference, nodeMap, geometryMap, groundGeometries, normalTransform, worldMatrix, `geometry`)

        let positions
        positions = [];
        // console.log(`groundGeometries:`, groundGeometries)
        groundGeometries.forEach(group => {
          if (!group.meshes) {
            if (!group.positions || !group.positions.length) return;
            for (const val of group.positions) {
              positions.push(val);
            }
          } else {
            group.meshes.forEach(mesh => {
              if (!mesh.positions || !mesh.positions.length) return;
              for (const val of mesh.positions) {
                positions.push(val);
              }
            });
          }
        });

        let center, size
        if (positions.length === 0) {
          // console.warn(`${reference.getAttribute("name")} has no positions`);
        } else {
          // console.log(`${reference.getAttribute(`name`)} positions:`, positions)
          center = await cal_item_center(positions);
          size = await cal_item_size(positions);
          // console.log(`center: ${center}, size: ${size}`);
        }

        geometries.push({
          name: reference.getAttribute(`name`) || referenceID,
          id: referenceID,
          meshes: groundGeometries,
          size: size,
          center: center,
        })
      } else {
        // console.log(`referenceID: ${reference.getAttribute(`id`)} referenceName: ${reference.getAttribute(`name`)}`)
        await walkNode(reference, nodeMap, geometryMap, geometries, normalTransform, worldMatrix)
      }
    }
  }

  // === instance_geometry ===
  instanceGeometry = node.querySelector(`:scope > instance_geometry`)
  if (instanceGeometry) {
    // console.log(`instanceGeometryURL: ${instanceGeometry.getAttribute(`url`)}`)
    let geometryID, geometry

    geometryID = instanceGeometry.getAttribute(`url`).replace(/^#/, ``)
    geometry = geometryMap.get(geometryID)
    if (geometry) {
      // console.log(`geometryMap.has? ${geometryMap.has(geometryID)} geometryID: ${geometryID} geometry: ${geometry}`)
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

        let position
        for (let i = 0; i < data.positions.length; i += 3) {
          position = vec3.fromValues(
            data.positions[i],
            data.positions[i + 1],
            data.positions[i + 2],
          )
          vec3.transformMat4(position, position, worldMatrix)
          positions.push(...position)
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
        let normal
        for (let i = 0; i < data.normals.length; i += 3) {
          normal = vec3.fromValues(
            data.normals[i],
            data.normals[i + 1],
            data.normals[i + 2],
          )
          let localNormalMatrix, worldMatrix_temp

          worldMatrix_temp = mat4.clone(worldMatrix)
          mat4.invert(worldMatrix_temp, worldMatrix_temp)
          mat4.transpose(worldMatrix_temp, worldMatrix_temp)
          localNormalMatrix = mat3.create()
          mat3.fromMat4(localNormalMatrix, worldMatrix_temp)
          vec3.transformMat3(normal, normal, localNormalMatrix)
          vec3.normalize(normal, normal)
          normals.push(...normal)
        }
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
  console.log(`data:`, data)
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
  // console.log("geometryMap keys:", [...geometryMap.keys()])

  data.geometries = []
  ZupToYup = mat4.create()
  fixRotation = mat4.create()
  fullRotation = mat4.create()
  normalTransform = mat3.create()

  mat4.fromXRotation(ZupToYup, -Math.PI / 2)
  // console.log(`ZupToYup:`, ZupToYup)
  mat4.fromYRotation(fixRotation, Math.PI / 2)
  // console.log(`fixRotation:`, fixRotation)
  mat4.multiply(fullRotation, fixRotation, ZupToYup)
  // console.log(`fullRotation:`, fullRotation)
  mat3.fromMat4(normalTransform, fullRotation)
  // console.log(`normalTransform:`, normalTransform)

  // Concurrency: A faster method, but it introduces bugs.
  // await Promise.all([...roots].map((root) => {
  //   walkNode(root, nodeMap, geometryMap, data.geometries, normalTransform, fullRotation, `instanceNode`)
  // }))

  // Serial
  for (const root of roots) {
    await walkNode(root, nodeMap, geometryMap, data.geometries, normalTransform, fullRotation, `instanceNode`)
  }

  // console.log(`data.geometries:`, data.geometries)

  let count

  ({ positions, count } = await collect_positions(data.geometries))
  // console.log(`Number of logical nodes: ${count}`)
  console.log(`data.geometries:`, data.geometries)
  console.log(`positions:`, positions)

  let size, center
  {
    size = await cal_item_size(positions)
    center = await cal_item_center(positions)
  }

  console.log(`GET geometryData success!:`, {
    meshes: data.geometries,
    size: size,
    center: center,
  })

  return {
    meshes: data.geometries,
    size: size,
    center: center,
  }
}
