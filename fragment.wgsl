@fragment
fn fragmentMain(
    @location(0) normal: vec3f,
    @location(1) color: vec4f,
) -> @location(0) vec4f {
    // 定义固定方向的光源向量（这里设为归一化的（1, 1, 1））
    let lightDirection = normalize(vec3f(1.0, 1.0, 1.0));
    // 计算漫反射强度（法线与光方向点乘的结果）
    let diffuse = max(dot(normal, lightDirection), 0.0);
    // 用漫反射强度缩放物体自身颜色（保持alpha不变）
    return vec4f(color.rgb * diffuse, color.a);
}