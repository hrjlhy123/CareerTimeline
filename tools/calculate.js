import { vec3, mat3, mat4 } from "../node_modules/gl-matrix/esm/index.js"

export async function cal_item_xyz(positions) {
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity

    for (let i = 0; i < positions.length; i += 3) {
        let x = positions[i], y = positions[i + 1], z = positions[i + 2]
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        if (z < minZ) minZ = z
        if (z > maxZ) maxZ = z
    }

    return {
        minX: minX,
        maxX: maxX,
        minY: minY,
        maxY: maxY,
        minZ: minZ,
        maxZ: maxZ,
    }
}

export async function cal_item_size(positions) {
    let minX, maxX, minY, maxY, minZ, maxZ

    ({ minX, maxX, minY, maxY, minZ, maxZ } = await cal_item_xyz(positions))

    let dx, dy, dz

    dx = maxX - minX
    dy = maxY - minY
    dz = maxZ - minZ

    return [dx, dy, dz]
}

export async function cal_item_center_simple(positions) {
    let minX, maxX, minY, maxY, minZ, maxZ

    ({ minX, maxX, minY, maxY, minZ, maxZ } = await cal_item_xyz(positions))

    let centerX = (minX + maxX) / 2
    let centerY = (minY + maxY) / 2
    let centerZ = (minZ + maxZ) / 2

    return [centerX, centerY, centerZ]
}

const angleSets = []
const angles = [-30, 0, 30].map(deg => deg * Math.PI / 180)
for (let ax of angles) {
  for (let ay of angles) {
    for (let az of angles) {
      // 排除没有旋转（纯AABB）
      if (ax === 0 && ay === 0 && az === 0) continue
      angleSets.push([ax, ay, az])
    }
  }
}

export async function cal_item_center(positions) {
  const points = []
  for (let i = 0; i < positions.length; i += 3) {
    points.push(vec3.fromValues(positions[i], positions[i + 1], positions[i + 2]))
  }

  const centers = []

  for (const [rx, ry, rz] of angleSets) {
    const transform = mat4.create()
    mat4.fromZRotation(transform, rz)
    mat4.rotateY(transform, transform, ry)
    mat4.rotateX(transform, transform, rx)

    const rotated = points.map(p => vec3.transformMat4(vec3.create(), p, transform))

    // 获取旋转后 AABB
    const bounds = await cal_item_xyz(flattenVecArray(rotated))
    const cx = (bounds.minX + bounds.maxX) / 2
    const cy = (bounds.minY + bounds.maxY) / 2
    const cz = (bounds.minZ + bounds.maxZ) / 2
    const center = vec3.fromValues(cx, cy, cz)

    // 反转回原始空间
    const inv = mat4.invert(mat4.create(), transform)
    vec3.transformMat4(center, center, inv)
    centers.push(center)
  }

  // 计算最终中心点（平均）
  const avg = vec3.create()
  centers.forEach(c => vec3.add(avg, avg, c))
  vec3.scale(avg, avg, 1 / centers.length)

  return [avg[0], avg[1], avg[2]]
}

function flattenVecArray(vecs) {
  const out = []
  for (let v of vecs) out.push(v[0], v[1], v[2])
  return out
}