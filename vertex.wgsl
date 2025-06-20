struct Uniforms {
    projectionMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>,
}

struct TransformData {
    modelMatrix: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> transform: array<TransformData>;

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) normal: vec3f,
    @location(1) color: vec4f,
}

@vertex
fn vertexMain(
    @location(0) position: vec3f,
    @location(1) normal: vec3f,
    @location(2) color: vec4f,
    @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
    // 应用实例的模型矩阵将顶点变换到世界坐标
    let modelMatrix = transform[instanceIndex].modelMatrix;
    let worldPosition = modelMatrix * vec4f(position, 1.0);
    let worldNormal = normalize((modelMatrix * vec4f(normal, 0.0)).xyz);

    // 计算裁剪空间位置：projectionMatrix * viewMatrix * worldPosition
    var output: VertexOutput;
    output.pos = uniforms.projectionMatrix * uniforms.viewMatrix * worldPosition;
    output.normal = worldNormal;
    output.color = color;
    return output;
}