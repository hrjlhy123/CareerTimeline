import { vec3, vec4, quat, mat3, mat4 } from "../node_modules/gl-matrix/esm/index.js"

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

// export async function worldToCanvasPos(point3D, matrix_view, matrix_projection, matrix_transform, canvas) {
//   const mvp = mat4.create();
//   mat4.multiply(mvp, matrix_view, matrix_transform);
//   mat4.multiply(mvp, matrix_projection, mvp);

//   const pos = vec4.fromValues(...point3D, 1);
//   vec4.transformMat4(pos, pos, mvp);
//   if (pos[3] === 0) return null;

//   // 齐次除法 → NDC
//   pos[0] /= pos[3];
//   pos[1] /= pos[3];

//   // NDC [-1, 1] → canvas 像素坐标
//   // const x = (pos[0] * 0.5 + 0.5) * canvas.width;
//   // const y = (1 - (pos[1] * 0.5 + 0.5)) * canvas.height;
//   const x = (pos[0] * 0.5 + 0.5) * canvas.clientWidth;
//   const y = (1 - (pos[1] * 0.5 + 0.5)) * canvas.clientHeight;

//   // console.log("canvas size:", canvas.width, canvas.height);
//   // console.log("NDC:", pos[0].toFixed(2), pos[1].toFixed(2));
//   // console.log("Canvas X,Y:", x.toFixed(2), y.toFixed(2));

//   return [x, y];
// }


export async function worldToCanvasPos(point3D, matrix_view, matrix_projection, matrix_world, canvas) {
  const mvp = mat4.create()
  // console.log(`point3D, matrix_view, matrix_projection, matrix_world, canvas:`, point3D, matrix_view, matrix_projection, matrix_world, canvas)
  mat4.multiply(mvp, matrix_view, matrix_world)
  mat4.multiply(mvp, matrix_projection, mvp)

  const pos = vec4.fromValues(...point3D, 1)
  vec4.transformMat4(pos, pos, mvp)
  if (pos[3] === 0) return null

  pos[0] /= pos[3]
  pos[1] /= pos[3]

  const x = (pos[0] * 0.5 + 0.5) * canvas.clientWidth
  const y = (1 - (pos[1] * 0.5 + 0.5)) * canvas.clientHeight

  return [x, y]
}

export async function getCoordinates(positions, matrix_view, matrix_projection, matrix_world, canvas) {
  let x, y
  // console.log("positions:", positions)
  for (let i = 0; i < positions.length; i += 3) {
    const point = [positions[i], positions[i + 1], positions[i + 2]];
    const canvasPos = await worldToCanvasPos(point, matrix_view, matrix_projection, matrix_world, canvas);
    if (!canvasPos) continue;

    [x, y] = canvasPos;
  }

  return {
    x: x,
    y: y,
  };
}

export async function quatToEuler(q) {
  const [x, y, z, w] = q;
  const out = [];

  const sinr_cosp = 2 * (w * x + y * z);
  const cosr_cosp = 1 - 2 * (x * x + y * y);
  out[0] = Math.atan2(sinr_cosp, cosr_cosp);

  const sinp = 2 * (w * y - z * x);
  out[1] = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

  const siny_cosp = 2 * (w * z + x * y);
  const cosy_cosp = 1 - 2 * (y * y + z * z);
  out[2] = Math.atan2(siny_cosp, cosy_cosp);

  return out;
}

export async function getRotations(matrix_world) {
  const q = quat.create();
  mat4.getRotation(q, matrix_world);
  const angles = await quatToEuler(q); // 弧度
  const [rx, ry, rz] = angles.map(rad => rad * 180 / Math.PI); // 转角度
  return { rx, ry, rz };
}