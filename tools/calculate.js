
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

    let dx, dy, dz,
        size

    dx = maxX - minX
    dy = maxY - minY
    dz = maxZ - minZ

    size = Math.max(dx, dy, dz)

    return size
}

export async function cal_item_center(positions) {
    let minX, maxX, minY, maxY, minZ, maxZ

    ({ minX, maxX, minY, maxY, minZ, maxZ } = await cal_item_xyz(positions))

    let centerX = (minX + maxX) / 2
    let centerY = (minY + maxY) / 2
    let centerZ = (minZ + maxZ) / 2

    return [centerX, centerY, centerZ]
}
