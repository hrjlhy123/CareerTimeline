import { vec3, vec4, mat3, mat4 } from "../node_modules/gl-matrix/esm/index.js"

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

export async function worldToCanvasPos(point3D, matrix_view, matrix_projection, matrix_transform, canvas) {
  const mvp = mat4.create();
  mat4.multiply(mvp, matrix_view, matrix_transform);
  mat4.multiply(mvp, matrix_projection, mvp);

  const pos = vec4.fromValues(...point3D, 1);
  vec4.transformMat4(pos, pos, mvp);
  if (pos[3] === 0) return null;

  // 齐次除法 → NDC
  pos[0] /= pos[3];
  pos[1] /= pos[3];

  // NDC [-1, 1] → canvas 像素坐标
  const x = (pos[0] * 0.5 + 0.5) * canvas.width;
  const y = (1 - (pos[1] * 0.5 + 0.5)) * canvas.height;

  // console.log("canvas size:", canvas.width, canvas.height);
  // console.log("NDC:", pos[0].toFixed(2), pos[1].toFixed(2));
  // console.log("Canvas X,Y:", x.toFixed(2), y.toFixed(2));

  return [x, y];
}

export async function getCanvasBounds(positions, matrix_view, matrix_projection, matrix_transform, canvas) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const point = [positions[i], positions[i + 1], positions[i + 2]];
    const canvasPos = await worldToCanvasPos(point, matrix_view, matrix_projection, matrix_transform, canvas);
    if (!canvasPos) continue;

    const [x, y] = canvasPos;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return {
    minX: Math.round(minX),
    maxX: Math.round(maxX),
    minY: Math.round(minY),
    maxY: Math.round(maxY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };
}