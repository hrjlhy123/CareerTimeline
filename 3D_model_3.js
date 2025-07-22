import { find_components } from "./tools/find.js";
import { geometryData } from "./read_dae_3.js"
import { mat4, vec3 } from "./node_modules/gl-matrix/esm/index.js"

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

        console.log("Supported features:");
        for (const feature of adapter.features) {
            console.log("  →", feature);
        }

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
    let cameraUniformBuffer, transformStorageBuffer, identityBuffer,
        globalBindGroupLayout, globalBindGroup,
        modelBindGroupLayout, identityBindGroup
    let compositeBindGroupLayout, compositeBindGroup
    let rotateNodeNames, rotateNodeIndices, rotateNodeElements, rotateBuffers, rotateBindGroups
    {
        // === Prepare model data ===
        {
            results = await geometryData(`./screenshot/scroll bar_2.dae`)
            // console.log(`results: ${JSON.stringify(results)}`)
            // console.log(`results.size: ${results.size}`)
            console.log(`results.center: ${results.center}`)
        }

        // === Prepare camera/transform buffer/bindGroup/bindGroupLayout ===
        {
            cameraUniformBuffer = device.createBuffer({
                size: 128, // 2 * mat4x4<f32>
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            })
            transformStorageBuffer = device.createBuffer({
                size: 64, // 1 * mat4x4<f32>
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            })

            identityBuffer = device.createBuffer({
                size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            })

            globalBindGroupLayout = device.createBindGroupLayout({
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
                    },
                ]
            })

            globalBindGroup = device.createBindGroup({
                layout: globalBindGroupLayout,
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
                    },
                ]
            })

            modelBindGroupLayout = device.createBindGroupLayout({
                entries: [
                    {
                        binding: 0, // @binding(0)
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: `uniform`,
                        }
                    },
                ]
            })

            identityBindGroup = device.createBindGroup({
                layout: modelBindGroupLayout,
                entries: [{ binding: 0, resource: { buffer: identityBuffer } }],
            })
        }

        // === Control 3D components (visible) ===
        {
            let nodes
            nodes = await find_components(results, `Board_Set`)
            // console.log(`nodes:`, nodes)
            nodes.forEach(node => {
                node.visible = true;
            });

            // console.log(`nodes:`, nodes)
        }

        // === Prepare rotate buffer/bindGroup/bindGroupLayout ===
        {
            let rotateNodes
            rotateNodeNames = [`Board_Set`]
            rotateNodes = []
            // console.log(`rotateNodes:`, rotateNodes)
            for (const rotateNodeName of rotateNodeNames) {
                rotateNodeElements = await find_components(results, rotateNodeName)
                rotateNodes.push(rotateNodeElements)
            }
            console.log(`rotateNodes:`, rotateNodes)
            rotateBuffers = {}
            rotateBindGroups = {}
            rotateNodes.forEach((rotateNodeElements) => {
                // console.log(`rotateNodeElements:`, rotateNodeElements)
                // console.log(`rotateNodeElements[0].name:`, rotateNodeElements[0].name)
                if (rotateNodeElements[0]) {
                    for (const index in rotateNodeElements) {
                        rotateNodeElements[index].rotateBuffer = device.createBuffer({
                            size: 64,
                            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                        });
                        rotateNodeElements[index].rotateBindGroup = device.createBindGroup({
                            layout: modelBindGroupLayout,
                            entries: [{ binding: 0, resource: { buffer: rotateNodeElements[index].rotateBuffer } }],
                        });
                    }
                }
            });
        }
    }

    // === Prepare buffer ===
    let vertexBufferLayout,
        matrix_projection, matrix_transform,
        matrix_view, matrix_view_world // view

    {
        // === Prepare buffer data ===
        {
            console.log(`meshes (tree):`, results.meshes)
            // === Write model data ===
            {
                const prepareBufferRecursive = (group, device) => {
                    if (!group.meshes) return;

                    for (const child of group.meshes) {
                        if (child.positions instanceof Float32Array) {
                            child.vertexBuffer = device.createBuffer({
                                label: `vertex buffer for ${child.name}`,
                                size: child.positions.byteLength,
                                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                            })
                            device.queue.writeBuffer(child.vertexBuffer, 0, child.positions)

                            child.normalDirBuffer = device.createBuffer({
                                lable: `normal buffer for ${child.name}`,
                                size: child.normals.byteLength,
                                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                            })
                            device.queue.writeBuffer(child.normalDirBuffer, 0, child.normals)

                            child.indexBuffer = device.createBuffer({
                                label: `index buffer for ${child.name}`,
                                size: child.indices.byteLength,
                                usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                            })
                            device.queue.writeBuffer(child.indexBuffer, 0, child.indices)

                            child.indexCount = child.indices.length

                            child.visible ??= true;
                        } else {
                            // console.log(`child:`, child)
                            prepareBufferRecursive(child, device)
                        }
                    }
                }
                prepareBufferRecursive(results, device)
            }
            // === Write camera/transform data ===
            let fov, aspect, near, far, f
            {
                // Perspective projection matrix
                {
                    fov = 30 * Math.PI / 180
                    aspect = canvas.width / canvas.height
                    near = 1
                    far = 1000
                    // f = 1 / Math.tan(fov / 2)
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
        vertex3DCodePath, fragmentCodePath, vertex2DCodePath, compositeCodePath,
        vertex3DCode, fragmentCode, vertex2DCode, compositeCode,
        vertex3DModule, fragmentModule, vertex2DModule, compositeModule
    {
        vertex3DCodePath = `vertex3D_2.wgsl`
        fragmentCodePath = `fragment_2.wgsl`
        vertex2DCodePath = `vertex2D.wgsl`
        compositeCodePath = `composite.wgsl`

        res = await fetch(vertex3DCodePath)
        vertex3DCode = await res.text()
        vertex3DModule = device.createShaderModule({
            label: `vertex 3D module`,
            code: vertex3DCode,
        })

        res = await fetch(fragmentCodePath)
        fragmentCode = await res.text()
        fragmentModule = device.createShaderModule({
            label: `fragment module`,
            code: fragmentCode,
        })

        res = await fetch(vertex2DCodePath)
        vertex2DCode = await res.text()
        vertex2DModule = device.createShaderModule({
            label: `vertex 2D module`,
            code: vertex2DCode,
        })

        res = await fetch(compositeCodePath)
        compositeCode = await res.text()
        compositeModule = device.createShaderModule({
            label: `composite module`,
            code: compositeCode,
        })
    }

    // === Prepare texture ===
    let MSAATexture, colorAccumTexture, colorResolvedTexture, depthTexture, alphaAccumTexture, alphaResolvedTexture
    {
        MSAATexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: canvasFormat,
            sampleCount: 4,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        })
        colorAccumTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: canvasFormat,
            sampleCount: 4,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
        colorResolvedTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: canvasFormat,
            sampleCount: 1,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        })
        depthTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: `depth24plus`,
            sampleCount: 4,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
        alphaAccumTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: `rgba16float`,
            sampleCount: 4,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
        alphaResolvedTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: `rgba16float`,
            sampleCount: 1,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        })

        compositeBindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                }
            ]
        })

        compositeBindGroup = device.createBindGroup({
            layout: compositeBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    // resource: MSAATexture.createView(),
                    resource: colorResolvedTexture.createView(),
                },
                {
                    binding: 1,
                    resource: alphaResolvedTexture.createView(),
                },

            ]
        })
    }

    // === Prepare pipeline layout ===
    let pipelineLayout
    {
        pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [globalBindGroupLayout, modelBindGroupLayout]
        })
    }

    // === Prepare render pipeline ===
    let renderPipeline, compositePipeline
    {
        renderPipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: vertex3DModule,
                entryPoint: `vertexMain`,
                buffers: [vertexBufferLayout.position, vertexBufferLayout.normal],
            },
            /* transparent */
            fragment: {
                module: fragmentModule,
                entryPoint: `fragmentMain`,
                targets: [
                    {
                        format: canvasFormat,
                        blend: {
                            color: {
                                srcFactor: `one`,
                                dstFactor: `zero`,
                                operation: `add`,
                            },
                            alpha: {
                                srcFactor: `one`,
                                dstFactor: `one-minus-src-alpha`,
                                operation: `add`,
                            }
                        }
                    },
                    {
                        format: `rgba16float`,
                        blend: {
                            color: {
                                srcFactor: `one`,
                                dstFactor: `zero`,
                                operation: `add`,
                            },
                            alpha: {
                                srcFactor: `one`,
                                dstFactor: `one-minus-src-alpha`,
                                operation: `add`,
                            }
                        }
                    }
                ]
            },
            depthStencil: {
                format: `depth24plus`,
                depthWriteEnabled: false,
                depthCompare: `less`,
            },
            multisample: {
                count: 4,
            }
        })

        compositePipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [compositeBindGroupLayout]
            }),
            vertex: {
                module: vertex2DModule,
                entryPoint: `vertexMain`,
            },
            fragment: {
                module: compositeModule,
                entryPoint: `compositeMain`,
                targets: [{
                    format: canvasFormat
                }]
            },
            primitive: {
                topology: `triangle-list`
            },
        })
    }

    // === debug ===
    let cubeVertexBuffer, cubeNormalBuffer, cubeIndexBuffer, cubeIndexCount,
        debugModelBuffer, debugBindGroup
    {
        const cubePositions = new Float32Array([
            // front
            -0.5, -0.5, 0.5,
            0.5, -0.5, 0.5,
            0.5, 0.5, 0.5,
            -0.5, 0.5, 0.5,
            // back
            -0.5, -0.5, -0.5,
            0.5, -0.5, -0.5,
            0.5, 0.5, -0.5,
            -0.5, 0.5, -0.5,
        ]);

        const cubeIndices = new Uint32Array([
            0, 1, 2, 2, 3, 0,  // front
            1, 5, 6, 6, 2, 1,  // right
            5, 4, 7, 7, 6, 5,  // back
            4, 0, 3, 3, 7, 4,  // left
            3, 2, 6, 6, 7, 3,  // top
            4, 5, 1, 1, 0, 4,  // bottom
        ]);

        const cubeNormals = new Float32Array(cubePositions.length); // 先全 0

        cubeVertexBuffer = device.createBuffer({
            size: cubePositions.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(cubeVertexBuffer, 0, cubePositions);

        cubeNormalBuffer = device.createBuffer({
            size: cubeNormals.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(cubeNormalBuffer, 0, cubeNormals);

        cubeIndexBuffer = device.createBuffer({
            size: cubeIndices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(cubeIndexBuffer, 0, cubeIndices);

        cubeIndexCount = cubeIndices.length;

        debugModelBuffer = device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        debugBindGroup = device.createBindGroup({
            layout: modelBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: debugModelBuffer } },
            ],
        });
    }

    // === Bind Mouse Control ===
    let yaw, globalRotate
    {
        yaw = 0
        canvas.addEventListener(`mousemove`, (e) => {
            if (e.buttons == 1) {
                yaw += e.movementX * 0.005
                // console.log(`yaw:`, yaw)
            }
        })
        // update your global model→world transform first:
        globalRotate = mat4.create();
        mat4.fromYRotation(globalRotate, yaw);
        const worldMatrix = mat4.create();
        mat4.multiply(worldMatrix, globalRotate, matrix_transform);
        device.queue.writeBuffer(transformStorageBuffer, 0,
            new Float32Array(worldMatrix));
    }

    // === Prepare render ===
    let renderRecursive = (renderPass, group, parentMatrix, parentBindGroup) => {
        // debug - find center渲染黑色 cube
        // {
        //     if (group.rotateBuffer) {
        //         // 1) 计算 cube 的 world 矩阵 = 全局 matrix_transform * translate(group.center)
        //         const modelMatrix = mat4.create();
        //         mat4.translate(modelMatrix, modelMatrix, group.center);

        //         // 2) 写到 debugModelBuffer
        //         device.queue.writeBuffer(debugModelBuffer, 0, new Float32Array(modelMatrix));

        //         // 3) 用 debugBindGroup 来画 cube
        //         renderPass.setBindGroup(1, debugBindGroup);
        //         renderPass.setVertexBuffer(0, cubeVertexBuffer);
        //         renderPass.setVertexBuffer(1, cubeNormalBuffer);
        //         renderPass.setIndexBuffer(cubeIndexBuffer, 'uint32');
        //         renderPass.drawIndexed(cubeIndexCount, 1);
        //     }
        // }
        let localMatrix, rotateMatrix, useBindGroup, useBuffer
        if (!group.meshes) return
        localMatrix = mat4.clone(parentMatrix)
        useBindGroup = parentBindGroup
        useBuffer = group.rotateBuffer ?? identityBuffer

        if (group.rotateBuffer) {
            rotateMatrix = modelRotate(mat4.create(), group.center, [angle, 0, 0]);
            mat4.multiply(localMatrix, parentMatrix, rotateMatrix);

            device.queue.writeBuffer(group.rotateBuffer, 0, new Float32Array(rotateMatrix));
            useBindGroup = group.rotateBindGroup;
        }
        device.queue.writeBuffer(useBuffer, 0, new Float32Array(localMatrix));

        renderPass.setBindGroup(1, useBindGroup)

        for (const child of group.meshes) {
            if (child.positions instanceof Float32Array) {
                renderPass.setVertexBuffer(0, child.vertexBuffer)
                renderPass.setVertexBuffer(1, child.normalDirBuffer)
                renderPass.setIndexBuffer(child.indexBuffer, `uint32`)
                renderPass.drawIndexed(child.indexCount, 1);
            } else {
                if (child.visible == false) continue
                renderRecursive(renderPass, child, localMatrix, useBindGroup)
            }
        }
    }

    const modelRotate = (matrix, center, angles) => {
        const T1 = mat4.create();
        const T2 = mat4.create();
        const RX = mat4.create();
        const RY = mat4.create();
        const RZ = mat4.create();
        const R = mat4.create();

        mat4.translate(T1, T1, center);
        mat4.translate(T2, T2, vec3.negate([], center));

        mat4.fromXRotation(RX, angles[0]);
        mat4.fromYRotation(RY, angles[1]);
        mat4.fromZRotation(RZ, angles[2]);

        // 按 XYZ 顺序旋转
        mat4.multiply(R, RX, RY);
        mat4.multiply(R, R, RZ);

        mat4.multiply(matrix, T1, R);
        mat4.multiply(matrix, matrix, T2);

        return matrix;
    }

    let angle,
        render, matrix_view_world_2

    angle = 0
    render = async () => {
        // === Control 3D components (Rotate, translate, and scale) ===
        {
            angle += 2 * Math.PI / 180 // +0.5 degrees per frame
        }

        let encoder, renderPass, compositePass
        encoder = device.createCommandEncoder()
        renderPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: MSAATexture.createView(),
                    resolveTarget: colorResolvedTexture.createView(),
                    loadOp: `clear`,
                    clearValue: {
                        r: 0.0,
                        g: 0.0,
                        b: 0.0,
                        a: 0.0
                    },
                    storeOp: `store`,
                },
                {
                    view: alphaAccumTexture.createView(),
                    resolveTarget: alphaResolvedTexture.createView(),
                    loadOp: `clear`,
                    clearValue: {
                        r: 0.0,
                        g: 0.0,
                        b: 0.0,
                        a: 0.0,
                    },
                    storeOp: `store`,
                }
            ],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: `clear`,
                depthStoreOp: `store`,
            }
        })

        renderPass.setPipeline(renderPipeline)
        renderPass.setBindGroup(0, globalBindGroup)

        let identity
        identity = mat4.create()
        mat4.identity(identity)

        renderRecursive(renderPass, results, identity, identityBindGroup);

        // === Mouse Control ===
        {
            globalRotate = mat4.create()
            mat4.fromYRotation(globalRotate, yaw)
            matrix_view_world_2 = mat4.create()
            mat4.multiply(matrix_view_world_2, globalRotate, matrix_transform)
            device.queue.writeBuffer(transformStorageBuffer, 0, matrix_view_world_2)
        }

        renderPass.end()

        compositePass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: `clear`,
                storeOp: `store`,
                clearValue: {
                    r: 1.0,
                    g: 1.0,
                    b: 1.0,
                    a: 1.0,
                }
            }]
        })

        compositePass.setPipeline(compositePipeline)
        compositePass.setBindGroup(0, compositeBindGroup)
        compositePass.draw(6)
        compositePass.end()

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
