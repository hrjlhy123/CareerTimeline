import { geometryData } from "./read_dae.js";

`use strict`;

window.addEventListener("DOMContentLoaded", async () => {
    // === WebGPU init ===

    let canvas, context, adapter, device, // GPUEnv
        canvasFormat, alphaMode, // GPUConfig
        result // Custom

    {
        navigator.gpu
            ?? (() => { throw new Error(`WebGPU not supported`) })()

        canvas = document.querySelector("canvas")
            ?? (() => { throw new Error(`Could not access canvas in page`) })()

        context = canvas.getContext(`webgpu`)
            ?? (() => { throw new Error(`Could not obtain WebGPU context for canvas`) })()

        adapter = await navigator.gpu.requestAdapter()
            ?? (() => { throw new Error(`No GPU adapter found`) })()

        device = await adapter.requestDevice()
            ?? (() => { throw new Error(`Failed to create a GPU device`) })()

        canvasFormat = navigator.gpu.getPreferredCanvasFormat()

        alphaMode = `premultiplied`

        context.configure({
            device: device,
            format: canvasFormat,
            alphaMode: alphaMode,
        })
    }

    // === Prepare data ===
    let positions, indices, 
        cameraUniformBuffer, transformStorageBuffer, 
        bindGroupLayout, bindGroup
    {
        // === Prepare model data ===
        {
            result = await geometryData(`./screenshot/mailbox slot.dae`)

            positions = result.positions
            indices = result.indices

            console.log(`result: ${JSON.stringify(result)}`)
        }

        // === Prepare camera/transform data ===
        {
            {
                cameraUniformBuffer = device.createBuffer({
                    size: 128, // 2 * mat4x4<f32>
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                })
                transformStorageBuffer = device.createBuffer({
                    size: 64, // 1 * mat4x4<f32>
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                })

                bindGroupLayout = device.createBindGroupLayout({
                    entries: [
                        {
                            binding: 0, // @binding(0)
                            visibility: GPUShaderStage.VERTEX,
                            buffer: {
                                type: `uniform`,
                            }
                        },
                        {
                            binding: 1, // @binding(1)
                            visibility: GPUShaderStage.VERTEX,
                            buffer: {
                                type: `read-only-storage`,
                            }
                        }
                    ]
                })

                bindGroup = device.createBindGroup({
                    layout: bindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: {
                                buffer: cameraUniformBuffer,
                            }
                        },
                        {
                            binding: 1,
                            resource: {
                                buffer: transformStorageBuffer,
                            }
                        }
                    ]
                })
            }
        }
    }

    // === Prepare buffer ===
    let vertexBuffer, indexBuffer
    let vertexBufferLayout
    {
        // === Prepare buffer data ===
        {
            // === Write model data ===
            {
                vertexBuffer = device.createBuffer({
                    label: `vertex buffer`,
                    size: positions.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false,
                })

                device.queue.writeBuffer(vertexBuffer, 0, positions)

                indexBuffer = device.createBuffer({
                    label: `index buffer`,
                    size: indices.byteLength,
                    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false,
                })

                device.queue.writeBuffer(indexBuffer, 0, indices)
            }

            // === Write camera/transform data ===
            let fov, aspect, near, far, f,
                matrix_projection, matrix_view, matrix_transform
            {
                // Perspective projection matrix
                {
                    fov = Math.PI / 4
                    aspect = canvas.width / canvas.height
                    near = 0.1
                    far = 100.0
                    f = 1 / Math.tan(fov / 2)
                    matrix_projection = new Float32Array([
                        f / aspect, 0, 0, 0,
                        0, f, 0, 0,
                        0, 0, (far + near) / (near - far), -1,
                        0, 0, (2 * far * near) / (near - far), 0,
                    ])
                }

                // View matrix
                {
                    matrix_view = new Float32Array([
                        1, 0, 0, 0,
                        0, 1, 0, 0,
                        0, 0, 1, 0,
                        0, 0, -5, 1,
                    ])
                }

                // Transform matrix
                {
                    matrix_transform = new Float32Array([
                        1, 0, 0, 0,
                        0, 1, 0, 0,
                        0, 0, 1, 0,
                        0, 0, 0, 1,
                    ])
                }

                device.queue.writeBuffer(cameraUniformBuffer, 0, matrix_projection)
                device.queue.writeBuffer(cameraUniformBuffer, 64, matrix_view)
                device.queue.writeBuffer(transformStorageBuffer, 0, matrix_transform)
            }
        }

        // === Prepare buffer layout ===
        {
            vertexBufferLayout = {
                arrayStride: 8 * 4, // 3 position + 3 normal + 2 uv = 8 float32 = 32 bytes
                attributes: [
                    {
                        shaderLocation: 0, // position, @location(0)
                        offset: 0,
                        format: `float32x3`,
                    },
                    {
                        shaderLocation: 1, // normal, @location(1)
                        offset: 3 * 4,
                        format: `float32x3`,
                    },
                    {
                        shaderLocation: 2, // uv, @location(2)
                        offset: 6 * 4,
                        format: `float32x2`,
                    }
                ]
            }
        }
    }

    // === Prepare shader module ===
    let res,
        vertexCodePath, fragmentCodePath,
        vertexCode, fragmentCode,
        vertexModule, fragmentModule
    {
        vertexCodePath = `vertex.wgsl`
        fragmentCodePath = `fragment.wgsl`

        res = await fetch(vertexCodePath)
        vertexCode = await res.text()
        vertexModule = device.createShaderModule({
            label: `vertex module`,
            code: vertexCode,
        })

        res = await fetch(fragmentCodePath)
        fragmentCode = await res.text()
        fragmentModule = device.createShaderModule({
            label: `fragment module`,
            code: fragmentCode,
        })
    }

    // === Prepare texture ===
    let MSAATexture, depthTexture
    {
        MSAATexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: canvasFormat,
            sampleCount: 4,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
        depthTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: `depth24plus`,
            sampleCount: 4,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
    }

    // === Prepare pipeline layout ===
    let pipelineLayout
    {
        pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        })
    }

    // === Prepare render pipeline ===
    let renderPipeline
    {
        renderPipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: vertexModule,
                entryPoint: `vertexMain`,
                buffers: [vertexBufferLayout],
            },
            fragment: {
                module: fragmentModule,
                entryPoint: `fragmentMain`,
                targets: [{
                    format: canvasFormat,
                    blend: {
                        color: {
                            srcFactor: `src-alpha`,
                            dstFactor: `one-minus-src-alpha`,
                            operation: `add`,
                        },
                        alpha: {
                            srcFactor: `one`,
                            dstFactor: `one-minus-src-alpha`,
                            operation: `add`,
                        }
                    }
                }]
            },
            depthStencil: {
                format: `depth24plus`,
                depthWriteEnabled: true,
                depthCompare: `less`,
            },
            multisample: {
                count: 4,
            }
        })
    }

    // === Prepare render ===
    let render
    render = () => {
        let encoder, renderPass
        encoder = device.createCommandEncoder()
        renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: MSAATexture.createView(),
                resolveTarget: context.getCurrentTexture().createView(),
                loadOp: `clear`,
                clearValue: {
                    r: 0.9,
                    g: 0.9,
                    b: 0.9,
                    a: 1.0
                },
                storeOp: `store`,
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: `clear`,
                depthStoreOp: `store`,
            }
        })

        renderPass.setPipeline(renderPipeline)
        renderPass.setBindGroup(0, bindGroup)

        renderPass.setVertexBuffer(0, vertexBuffer)
        renderPass.setIndexBuffer(indexBuffer, `uint32`)

        renderPass.drawIndexed(indices.length)
        renderPass.end()

        device.queue.submit([encoder.finish()])
    }

    // === Render ===
    let frame
    frame = () => {
        render()
        requestAnimationFrame(frame)
    }
    frame()
})

