@fragment
fn fragmentMain(
@location(0) normal : vec3f
) -> @location(0) vec4f {
    let lightDir = normalize(vec3f(1.0, 1.0, -1.0));
    let lambert = max(dot(normalize(normal), lightDir), 0.0);

    let viewDir = normalize(vec3f(0.5, 1.0, -1.0));
    let halfDir = normalize(lightDir + viewDir);
    let spec = pow(max(dot(normal, halfDir), 0.0), 32.0); // shininess = 32
    let specular = vec3f(1.0, 1.0, 1.0) * spec;

    let ambient = 0.2;

    let baseColor = vec3f(1.0, 1.0, 1.0);

    let finalColor = baseColor * (ambient + lambert) + specular;
    return vec4f(finalColor, 0.5);
}
