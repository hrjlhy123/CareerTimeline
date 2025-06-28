@group(0) @binding(0) var colorAccumTex : texture_2d<f32>;
@group(0) @binding(1) var alphaAccumTex : texture_2d<f32>;

@fragment
fn compositeMain(
@builtin(position) coord : vec4f
) -> @location(0) vec4f {
    let uv = coord.xy / vec2f(textureDimensions(colorAccumTex));
    let texCoord = vec2<i32>(floor(coord.xy));
    let colorAccum = textureLoad(colorAccumTex, texCoord, 0);
    let alphaAccum = textureLoad(alphaAccumTex, texCoord, 0);

    let finalColor = colorAccum.rgb / max(alphaAccum.a, 0.0001);//avoid 0
    let alpha = textureLoad(alphaAccumTex, texCoord, 0).a;
    return vec4f(finalColor, alpha);
}
