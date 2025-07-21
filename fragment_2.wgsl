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
    let spec = pow(max(dot(normal, halfDir), 0.0), 64.0); // shininess = 64
    let specular = vec3f(0.4, 0.4, 0.4) * spec;

    let ambient = 0.4;
    let baseColor = vec3f(0.85, 0.95, 1.0);

    
    let alpha = 0.1;
    let weight1 = 200.0;
    let weight2 = 0.5;


    let finalColor = baseColor * alpha * weight2 + specular * weight1;

    output.outColor = vec4f(finalColor, 1.0);
    output.outAlpha = vec4f(0.0, 0.0, 0.0, alpha * weight2);

    return output;
}
