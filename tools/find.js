export async function find_components(group, name) {
    let matches = []
    if (!group.meshes) return matches

    for (const child of group.meshes) {
        if (child.name == name) {
            matches.push(child)
        }

        if (!child.positions) {
            const found = await find_components(child, name)
            matches.push(...found)
        }
    }

    return matches
}