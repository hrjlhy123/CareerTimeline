struct Output {
    @location(0) outColor : vec4f,
    @location(1) outAlpha : vec4f,
}

@fragment
fn fragmentMain(
@location(0) normal : vec3f,
@builtin(position) pos : vec4f,
) -> Output {
    var output : Output;

    let lightDir = normalize(vec3f(1.0, 1.0, -1.0));
    let lambert = max(dot(normalize(normal), lightDir), 0.0);
    let viewDir = normalize(vec3f(1.0, 1.0, -1.0));
    let halfDir = normalize(lightDir + viewDir);
    let spec = pow(max(dot(normal, halfDir), 0.0), 128.0); // shininess = 32
    let specular = vec3f(1.0, 1.0, 1.0) * spec;

    let ambient = 0.4;
    let baseColor = vec3f(0.8, 0.9, 1.0);
    let finalColor = baseColor * (ambient + lambert) + specular;

    let alpha = 0.1;
    // let weight = clamp(pow(alpha + 0.01, 3.5) + 0.01, 0.0, 1.0);
    let weight = 0.35;

    output.outColor = vec4f(finalColor * alpha * weight, alpha);
    output.outAlpha = vec4f(0.0, 0.0, 0.0, alpha * weight);

    return output;
}
