@fragment
fn fragmentMain(
@location(0) normal: vec3f
) -> @location(0) vec4f {
    let lightDir = normalize(vec3f(1.0, 1.0, -1.0));
    let lambert = max(dot(normalize(normal), lightDir), 0.0);
    let baseColor = vec3f(0.4, 0.6, 0.8);
    // return vec4f(0.4, 0.6, 0.8, 1.0);
    return vec4f(baseColor * lambert, 0.8);
}