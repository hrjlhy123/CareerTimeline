// export async function collect_positions(groups, visited = new Set()) {
//     let positions = []

//     for (const group of groups) {
//         const groupId = group.id || group.name
//         console.log(`collecting group:`, groupId, group)

//         // Avoid infinite loops
//         if (visited.has(groupId)) {
//             console.warn(`already visited: ${groupId}, skipping`)
//             continue
//         }
//         visited.add(groupId)

//         if (!group.meshes || group.meshes.length === 0) continue

//         const isLeaf = group.meshes.every(m => m.positions instanceof Float32Array)

//         if (isLeaf) {
//             for (const mesh of group.meshes) {
//                 positions.push(...mesh.positions)
//             }
//         } else {
//             console.warn(`group is not leaf, recurse:`, groupId)
//             let childPositions
//             childPositions = await collect_positions(group.meshes, visited)
//             positions.push(...childPositions)
//         }
//     }

//     return positions
// }

export async function collect_positions(groups) {
    let positions = []
    let count = 0

    for (const group of groups) {
        const groupId = group.id || group.name
        console.log(`collecting group:`, groupId, group)

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