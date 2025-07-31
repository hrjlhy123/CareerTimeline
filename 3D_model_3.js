import { find_components } from "./tools/find.js";
import { worldToCanvasPos, getCanvasBounds } from "./tools/calculate.js"
import { geometryData } from "./read_dae_3.js"
import { mat4, vec3 } from "./node_modules/gl-matrix/esm/index.js"

`use strict`;
// 3D component states
let modelStates
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
        console.log(`canvas size:`, canvas.width, canvas.height)

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
    let modelTransformNodeNames, modelTransformNodeElements
    {
        // === Prepare model data ===
        {
            results = await geometryData(`./screenshot/scroll bar_4.dae`)
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
                size: 64,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
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

        // === Prepare model transform buffer/bindGroup/bindGroupLayout ===
        {
            let modelTransformNodes
            modelTransformNodeNames = [`Board_Set`]
            modelTransformNodes = []
            // console.log(`modelTransformNodes:`, modelTransformNodes)
            for (const modelTransformNodeName of modelTransformNodeNames) {
                modelTransformNodeElements = await find_components(results, modelTransformNodeName)
                modelTransformNodes.push(modelTransformNodeElements)
            }
            console.log(`modelTransformNodes:`, modelTransformNodes)
            modelStates = []
            modelTransformNodes.forEach((modelTransformNodeElements) => {
                // console.log(`modelTransformNodeElements:`, modelTransformNodeElements)
                // console.log(`modelTransformNodeElements[0].name:`, modelTransformNodeElements[0].name)
                if (modelTransformNodeElements[0]) {
                    modelTransformNodeElements.forEach((node, index) => {
                        node.transformIndex = index
                        node.modelTransformBuffer = device.createBuffer({
                            size: 64,
                            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                        });
                        node.modelTransformBindGroup = device.createBindGroup({
                            layout: modelBindGroupLayout,
                            entries: [{ binding: 0, resource: { buffer: node.modelTransformBuffer } }],
                        });
                        console.log(`node.id:`, node.id)
                        let angle_unique = { x: 0, y: 0, z: 0 }
                        if (index == 1) {
                            angle_unique.x = Math.PI / 180 * 330
                        } else if (index == 0) {
                            angle_unique.x = Math.PI / 180 * 210
                        } else if (index == 5) {
                            angle_unique.x = Math.PI / 180 * 90
                        } else if (index == 6 || 7 || 8) {
                            angle_unique.x = Math.PI / 180 * 180
                        }
                        modelStates.push({
                            angle: { x: 0, y: 0, z: 0 },
                            center: { x: node.center[0], y: node.center[1], z: node.center[2] },
                            translation: { x: 0, y: 0, z: 0 },
                            direction: { x: 1, y: 1, z: 1 },
                            deltaAngle: { x: angle_unique.x, y: 0, z: 0 },
                            frameCount: 0
                        })
                    })
                    console.log(`modelStates:`, modelStates)
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

                dist = Math.max(...results.size) * 2

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
            /* opaque */
            // fragment: {
            //     module: fragmentModule,
            //     entryPoint: `fragmentMain`,
            //     targets: [
            //         {
            //             format: canvasFormat,
            //         },
            //         {
            //             format: `rgba16float`,
            //         }
            //     ]
            // },
            // depthStencil: {
            //     format: `depth24plus`,
            //     depthWriteEnabled: true,
            //     depthCompare: `less`,
            // },
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

    // === transform ===
    const modelTransform = (matrix, center, angles, translation) => {
        const T_center = mat4.create();   // 把原点移到 center
        const T_center_inv = mat4.create(); // 把原点移回
        const T_translate = mat4.create(); // 额外平移
        const RX = mat4.create();
        const RY = mat4.create();
        const RZ = mat4.create();
        const R = mat4.create();

        // 平移到旋转中心
        mat4.translate(T_center, T_center, center);
        mat4.translate(T_center_inv, T_center_inv, vec3.negate([], center));

        // 旋转矩阵
        mat4.fromXRotation(RX, angles[0]);
        mat4.fromYRotation(RY, angles[1]);
        mat4.fromZRotation(RZ, angles[2]);

        mat4.multiply(R, RX, RY);
        mat4.multiply(R, R, RZ);

        // 平移矩阵
        mat4.translate(T_translate, T_translate, translation);

        // 合成矩阵: T_translate * T_center * R * T_center_inv
        mat4.identity(matrix);
        mat4.multiply(matrix, matrix, T_translate);
        mat4.multiply(matrix, matrix, T_center);
        mat4.multiply(matrix, matrix, R);
        mat4.multiply(matrix, matrix, T_center_inv);

        return matrix;
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
    let yaw, globalRotate, deltaAngle, scrollSpeed, rangeAngle
    deltaAngle = 0
    scrollSpeed = 0.01
    rangeAngle = [-10, 10]
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
        device.queue.writeBuffer(transformStorageBuffer, 0, new Float32Array(worldMatrix));

        window.addEventListener(`wheel`, (event) => {
            deltaAngle -= event.deltaY * scrollSpeed
            deltaAngle = Math.max(rangeAngle[0], Math.min(rangeAngle[1], deltaAngle))
        })
    }
    const wheelResistance = () => {
        if (Math.abs(deltaAngle) < 0.01) {
            deltaAngle = 0
            return
        }
        deltaAngle *= 0.97  // 每帧逐渐衰减
    }

    // === Prepare render ===
    let renderRecursive = (renderPass, group, parentMatrix, parentBindGroup) => {
        // debug - find center渲染黑色 cube
        // {
        //     if (group.modelTransformBuffer) {
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
        let localMatrix, modelTransformMatrix, useBindGroup, useBuffer
        if (!group.meshes) return
        localMatrix = mat4.clone(parentMatrix)
        useBindGroup = parentBindGroup ?? identityBindGroup
        useBuffer = group.modelTransformBuffer ?? identityBuffer

        if (group.modelTransformBuffer) {
            let state
            state = modelStates[group.transformIndex]
            // if (group.transformIndex == 1) {
            //     console.log(`state.angle.x:`, state.angle.x)
            // }

            modelTransformMatrix = modelTransform(
                mat4.create(), group.center,
                [state.angle.x, state.angle.y, state.angle.z],
                [state.translation.x, state.translation.y, state.translation.z]
            )
            mat4.multiply(localMatrix, parentMatrix, modelTransformMatrix);

            device.queue.writeBuffer(group.modelTransformBuffer, 0, new Float32Array(modelTransformMatrix));
            useBindGroup = group.modelTransformBindGroup;
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

    let render, matrix_view_world_2
    render = async (deltaTime) => {
        // === Control 3D components (Rotate, translate, and scale) ===
        {
            let
                r, d,
                y_top, y_bottom, y_top_change, y_bottom_change,
                z_left, z_right, z_middle,
                circleCenter, circleRadius, circumference,
                rotateSpeed, deltaAngleRad, totalFrames
            r = {
                x: 0,
                y: 0,
                z: 0,
            }
            d = {
                x: 0,
                y: 0,
                z: 0,
            }
            // index == 0

            // results.center[1] = 18.876420974731445
            // state.center.y = -23.03149712085724
            // bottom = results.center[1] - Math.abs(state.center.y) = -4.155076146125795

            // index == 2

            // results.center[1] = 18.876420974731445
            // state.center.y = 42.34403991699219
            // top = state.center.y = 42.34403991699219

            // Guide_Wheel_Set (top/bottom)

            // state.center.y_Guilde_Wheel_Set_top = 36.811017990112305
            // state.center.y_Guilde_Wheel_Set_bottom = 1.3779478073120117
            // top_change_z = state.center.y_Guilde_Wheel_Set_top = 36.811017990112305
            // bottom_change_z = state.center.y_Guilde_Wheel_Set_bottom = 1.3779478073120117

            // index = 1

            // results.center[2] = -31.508955001831055
            // state.center.z = -37.04197692871094
            // right = results.center[2] + Math.abs(state.center.z) + results.center[2] = -25.97593307495117
            // left = results.center[2] - Math.abs(state.center.z) + results.center[2] = -37.04197692871094

            y_top = 43.06108856201172
            y_bottom = -4.872117042541504
            y_top_change = 36.811031341552734
            y_bottom_change = 1.377947449684143
            z_left = -37.759029388427734
            z_right = -25.258892059326172
            z_middle = -31.50895881652832

            // circleCenter = [
            //     { y: y_top_change, z: z_middle },
            //     { y: y_bottom_change, z: z_middle },
            // ];
            circleRadius = y_top - y_top_change
            // circumference = Math.PI * circleRadius * 2
            // console.log(circleRadius * Math.PI / (y_top_change - y_bottom_change))

            // rotateSpeed = 90
            // deltaAngle = 1
            // deltaAngle = rotateSpeed * deltaTime
            deltaAngleRad = deltaAngle ? deltaAngle * Math.PI / 180 : 0
            d.y = circleRadius * deltaAngleRad
            d.z = circleRadius * deltaAngleRad

            totalFrames = Math.round(360 + 2 * (y_top_change - y_bottom_change) / (circleRadius * Math.PI / 180))

            modelStates.forEach((state, index) => {
                // if (index == 8) {
                // state.time = (state.time || 0) + deltaTime
                if ((state.translation.y + state.center.y >= y_bottom) && (state.translation.y + state.center.y <= y_top)) {
                    state.angle.x += deltaAngleRad
                    state.direction.z = Math.sin(state.angle.x - state.deltaAngle.x)
                    if (state.translation.y + state.center.y > y_top_change) {
                        // console.log(1)
                        state.direction.y = Math.cos(state.angle.x - state.deltaAngle.x)
                    } else if (state.translation.y + state.center.y < y_bottom_change) {
                        // console.log(2)
                        state.direction.y = Math.cos(state.angle.x - state.deltaAngle.x)
                    } else {
                        // console.log(3)
                        if (state.translation.z + state.center.z >= z_middle) {
                            // console.log(3.1)
                            state.translation.z = z_right - state.center.z
                            state.direction.y = -1
                            state.angle.x = Math.PI / 180 * 180 + state.deltaAngle.x
                        } else {
                            // console.log(3.2)
                            state.translation.z = z_left - state.center.z
                            state.direction.y = 1
                            state.angle.x = Math.PI / 180 * 0 + state.deltaAngle.x
                        }
                    }
                } else {
                    // console.log(4)
                    state.direction.y = Math.cos(state.angle.x - state.deltaAngle.x)
                    state.direction.z = 0
                    if (state.translation.y + state.center.y > y_top) {
                        // console.log(4.1)
                        state.translation.y = y_top - state.center.y
                        state.angle.x = Math.PI / 180 * 90 + state.deltaAngle.x
                    } else if (state.translation.y + state.center.y < y_bottom) {
                        // console.log(4.2)
                        state.translation.y = y_bottom - state.center.y
                        state.angle.x = Math.PI / 180 * 270 + state.deltaAngle.x
                    }
                }
                state.translation.y += d.y * state.direction.y
                state.translation.z += d.z * state.direction.z

                let moved
                moved = d.y * state.direction.y !== 0 || d.z * state.direction.z !== 0
                if (moved) {
                    state.frameCount = (state.frameCount || 0) + deltaAngle
                }
                // console.log(`state.frameCount:totalFrames:`, state.frameCount, `:`, totalFrames)
                if (state.frameCount >= totalFrames || state.frameCount <= -totalFrames || state.frameCount == 0) {
                    state.translation.y = 0
                    state.translation.z = 0
                    state.angle.x = 0
                    state.frameCount = 0
                }
                // }
            });
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
    let frame, lastTime, deltaTime,
        modelMatrix, bounds, center
    lastTime = performance.now()
    frame = async (now) => {
        deltaTime = (now - lastTime) / 1000
        lastTime = now
        wheelResistance()
        render(deltaTime)

        // Get screen coordinates
        modelMatrix = await modelTransform(mat4.create(), results.center, [0, 0, 0], [0, 0, 0]);
        bounds = await getCanvasBounds(results.center, matrix_view, matrix_projection, matrix_transform, canvas);
        center = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];

        console.log(`图形中心在 canvas 上位置:`, center);
        console.log(`图形投影边界:`, bounds);

        requestAnimationFrame(frame)
    }
    frame()

})

// === export data ===
export async function getModelStates() {
    // console.log(`modelStates:`, modelStates)
    return modelStates
}
