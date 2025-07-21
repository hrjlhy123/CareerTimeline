export async function collect_positions(groups) {
    let positions = []
    let count = 0

    for (const group of groups) {
        const groupId = group.id || group.name
        // console.log(`collecting group:`, groupId, group)

        if (!group.meshes || group.meshes.length === 0) continue

        for (const mesh of group.meshes) {
            if (mesh.positions instanceof Float32Array) {
                positions.push(...mesh.positions)
                count += 1
            } else if (mesh.meshes) {
                const { positions: childPositions, count: childCount } = await collect_positions([mesh])
                positions.push(...childPositions)
                count += childCount
            }
        }
    }

    return { positions, count }
}

export async function collect_meshes(groups) {
    const leafMeshes = [];
    for (const group of groups) {
        if (!group.meshes) continue;

        const isLeaf = group.meshes.every(m => m.positions instanceof Float32Array);
        if (isLeaf) {
            leafMeshes.push(...group.meshes);
        } else {
            const meshes = await collect_meshes(group.meshes)
            leafMeshes.push(...meshes);
        }
    }
    return leafMeshes;
}