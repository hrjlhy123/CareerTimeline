import { geometryData } from "./read_dae_2.js";
import { mat4, vec3 } from "./node_modules/gl-matrix/esm/index.js";

`use strict`;

window.addEventListener("DOMContentLoaded", async () => {
    // === WebGPU init ===

    let canvas, context, adapter, device, // GPUEnv
        canvasFormat, alphaMode, dpr, // GPUConfig
        results // Custom

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

        dpr = window.devicePixelRatio || 1

        canvas.width = canvas.clientWidth * dpr
        canvas.height = canvas.clientHeight * dpr

        context.configure({
            device: device,
            format: canvasFormat,
            alphaMode: alphaMode,
            size: [canvas.width, canvas.height]
        })
    }

    // === Prepare data ===
    let cameraUniformBuffer, transformStorageBuffer,
        bindGroupLayout, bindGroup
    {
        // === Prepare model data ===
        {
            results = await geometryData(`./screenshot/scroll bar_2.dae`)
            // console.log(`results: ${JSON.stringify(results)}`)
            // console.log(`results.size: ${results.size}`)
            // console.log(`results.center: ${typeof (results.center)} ${results.center}`)
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
    let meshBuffers,
        vertexBuffer, normalDirBuffer, indexBuffer,
        vertexBufferLayout,
        matrix_projection, matrix_transform,
        matrix_view, matrix_view_world // view

    {
        // === Prepare buffer data ===
        {
            // === Write model data ===
            meshBuffers = results.meshes.map(result => {
                // console.log(Math.max(...result.positions))
                vertexBuffer = device.createBuffer({
                    label: `vertex buffer for ${result.name}`,
                    size: result.positions.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false,
                })

                device.queue.writeBuffer(vertexBuffer, 0, result.positions)

                normalDirBuffer = device.createBuffer({
                    label: `normal buffer for ${result.name}`,
                    size: result.normals.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false,
                })

                device.queue.writeBuffer(normalDirBuffer, 0, result.normals)

                indexBuffer = device.createBuffer({
                    label: `index buffer for ${result.name}`,
                    size: result.indices.byteLength,
                    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false,
                })

                device.queue.writeBuffer(indexBuffer, 0, result.indices)

                return {
                    name: result.name,
                    vertexBuffer,
                    normalDirBuffer,
                    indexBuffer,
                    indexCount: result.indices.length,
                }
            })

            // === Write camera/transform data ===
            let fov, aspect, near, far, f
            {
                // Perspective projection matrix
                {
                    fov = 30 * Math.PI / 180
                    aspect = canvas.width / canvas.height
                    near = 1
                    far = 1000
                    f = 1 / Math.tan(fov / 2)
                    matrix_projection = mat4.create()

                    mat4.perspective(matrix_projection, fov, aspect, near, far)
                }

                // View matrix
                let dist, eye, target, up

                dist = results.size * 2

                console.log(`dist: ${dist}`)
                eye = [0, 0, -dist]
                target = [0, 0, 0]
                up = [0, 1, 0]

                {
                    matrix_view_world = mat4.create()
                    mat4.lookAt(matrix_view_world, eye, target, up)

                    matrix_view = mat4.create()
                    mat4.invert(matrix_view, matrix_view_world)
                }

                // Transform matrix
                let center
                {
                    matrix_transform = mat4.create()
                    center = results.center.map(value => -value)
                    mat4.translate(matrix_transform, matrix_transform, center)
                }

                console.log(`eye: ${eye}, center: ${center}, dist: ${vec3.distance(eye, center)}, near: ${near}`)

                device.queue.writeBuffer(cameraUniformBuffer, 0, matrix_projection)
                device.queue.writeBuffer(cameraUniformBuffer, 64, matrix_view)
                device.queue.writeBuffer(transformStorageBuffer, 0, matrix_transform)
            }
        }

        // === Prepare buffer layout ===
        vertexBufferLayout = {
            position: {},
            normal: {},
        }

        {
            vertexBufferLayout.position = {
                arrayStride: 3 * 4, // 3 * float32 = 32 bytes
                attributes: [
                    {
                        shaderLocation: 0,
                        offset: 0,
                        format: `float32x3`
                    }
                ]
            }

            vertexBufferLayout.normal = {
                arrayStride: 3 * 4, // 3 * float32 = 32 bytes
                attributes: [
                    {
                        shaderLocation: 1,
                        offset: 0,
                        format: `float32x3`
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
                buffers: [vertexBufferLayout.position, vertexBufferLayout.normal],
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
    let render, matrix_view_world_2
    render = () => {
        let encoder, renderPass
        encoder = device.createCommandEncoder()
        renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: MSAATexture.createView(),
                resolveTarget: context.getCurrentTexture().createView(),
                loadOp: `clear`,
                clearValue: {
                    r: 0.0,
                    g: 0.0,
                    b: 0.0,
                    a: 0.0
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

        for (let mesh of meshBuffers) {
            renderPass.setVertexBuffer(0, mesh.vertexBuffer)
            renderPass.setVertexBuffer(1, mesh.normalDirBuffer)
            renderPass.setIndexBuffer(mesh.indexBuffer, `uint32`)
            renderPass.drawIndexed(mesh.indexCount)
        }

        {
            rotate = mat4.create()
            mat4.fromYRotation(rotate, yaw)
            matrix_view_world_2 = mat4.create()
            mat4.multiply(matrix_view_world_2, rotate, matrix_transform)
            device.queue.writeBuffer(transformStorageBuffer, 0, matrix_view_world_2)
        }

        renderPass.end()

        device.queue.submit([encoder.finish()])
    }

    // === Control ===
    let yaw, rotate
    yaw = 0
    canvas.addEventListener(`mousemove`, (e) => {
        if (e.buttons == 1) {
            yaw += e.movementX * 0.005
            // console.log(`yaw:`, yaw)
        }
    })

    // === Render ===
    let frame
    frame = () => {
        render()
        requestAnimationFrame(frame)
    }
    frame()
})

