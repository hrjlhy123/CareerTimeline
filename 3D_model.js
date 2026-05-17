import { find_components } from "./tools/find.js";
import { geometryData } from "./read_dae.js"
import { mat4, vec3 } from "./node_modules/gl-matrix/esm/index.js"

"use strict";
// 3D component states
let results, modelStates, matrix_view, matrix_projection, matrix_transform, matrix_world, canvas
let timelineScrollPixels = 0;

export function queueTimelineScroll(deltaY = 0) {
    if (!Number.isFinite(deltaY)) return;

    const MAX_PENDING_SCROLL = 600;

    timelineScrollPixels += deltaY;
    timelineScrollPixels = Math.max(
        -MAX_PENDING_SCROLL,
        Math.min(MAX_PENDING_SCROLL, timelineScrollPixels)
    );
}

export function clearTimelineScrollQueue() {
    timelineScrollPixels = 0;
}
window.addEventListener("DOMContentLoaded", async () => {
    // === WebGPU init ===

    function enableNoWebGPULayout(reason = "WebGPU unavailable") {
        console.warn(reason);

        document.documentElement.classList.add("no-webgpu");
        window.__NO_WEBGPU__ = true;
    }
    // let canvas, 
    let context, adapter, device, // GPUEnv
        canvasFormat, alphaMode, dpr // GPUConfig
    // results // Custom
    let resizeCanvasBackingStore = () => false;
    let recreateRenderTargets = () => { };
    let updateProjectionForResize = () => { };
    let resizeTimelineGPU = () => { };

    {
        if (window.__NO_WEBGPU__ || document.documentElement.classList.contains("no-webgpu")) {
            enableNoWebGPULayout("WebGPU disabled by compatibility fallback");
            return;
        }

        if (!navigator.gpu) {
            enableNoWebGPULayout("WebGPU not supported");
            return;
        }

        canvas = document.querySelector("canvas.timelineBelt");

        if (!canvas) {
            enableNoWebGPULayout("Could not access timeline canvas");
            return;
        }

        context = canvas.getContext("webgpu");

        if (!context) {
            enableNoWebGPULayout("Could not obtain WebGPU context");
            return;
        }

        adapter = await navigator.gpu.requestAdapter();

        if (!adapter) {
            enableNoWebGPULayout("No GPU adapter found");
            return;
        }

        console.log("Supported features:");
        for (const feature of adapter.features) {
            console.log("  →", feature);
        }

        try {
            device = await adapter.requestDevice();
        } catch (error) {
            enableNoWebGPULayout("Failed to create a GPU device");
            return;
        }

        canvasFormat = navigator.gpu.getPreferredCanvasFormat();

        alphaMode = `premultiplied`;

        resizeCanvasBackingStore = () => {
            dpr = Math.min(2, window.devicePixelRatio || 1);

            const cssWidth = canvas.clientWidth;
            const cssHeight = canvas.clientHeight;

            if (cssWidth <= 0 || cssHeight <= 0) {
                return false;
            }

            const width = Math.max(2, Math.floor(cssWidth * dpr));
            const height = Math.max(2, Math.floor(cssHeight * dpr));

            if (canvas.width === width && canvas.height === height) {
                return false;
            }

            canvas.width = width;
            canvas.height = height;

            context.configure({
                device,
                format: canvasFormat,
                alphaMode,
                size: [canvas.width, canvas.height],
            });

            console.log(`Timeline canvas resized:`, canvas.width, canvas.height);

            return true;
        };

        resizeCanvasBackingStore();
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
            results = await geometryData(`./resources/scroll bar_4.dae`)
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
                        let correction = {
                            x: 0, y: 0, z: 0,
                            r: 0
                        }
                        if (index == 0) {
                            correction.r = Math.PI / 180 * 210
                            correction.y = (-0.005 / 0.0254) * 0.5
                            correction.z = (-0.005 / 0.0254) * Math.sqrt(3)
                        } else if (index == 1) {
                            correction.r = Math.PI / 180 * 330
                            correction.y = (-0.005 / 0.0254) * 0.5
                            correction.z = (0.005 / 0.0254) * Math.sqrt(3)
                        } else if (index == 2 || index == 3 || index == 4) {
                            correction.z = 0.005 / 0.0254
                        } else if (index == 5) {
                            correction.r = Math.PI / 180 * 90
                            correction.y = (0.005 / 0.0254)
                        } else if (index == 6 || index == 7 || index == 8) {
                            correction.r = Math.PI / 180 * 180
                            correction.z = -0.005 / 0.0254
                        }
                        modelStates.push({
                            angle: { rx: 0, ry: 0, rz: 0 },
                            center: { x: node.center[0] + correction.x, y: node.center[1] + correction.y, z: node.center[2] + correction.z },
                            translation: { x: 0, y: 0, z: 0 },
                            direction: { x: 1, y: 1, z: 1 },
                            deltaAngle: { rx: correction.r, ry: 0, rz: 0 },
                            frameCount: 0
                        })
                    })
                    console.log(`modelStates:`, modelStates)
                }
            });
        }
    }

    // === Prepare buffer ===
    let vertexBufferLayout
    // matrix_projection, matrix_transform
    // matrix_view

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

                    updateProjectionForResize = () => {
                        if (!matrix_projection || !cameraUniformBuffer) return;

                        aspect = canvas.width / canvas.height;

                        mat4.perspective(
                            matrix_projection,
                            fov,
                            aspect,
                            near,
                            far
                        );

                        device.queue.writeBuffer(cameraUniformBuffer, 0, matrix_projection);
                    };
                }

                // View matrix
                let dist, eye, target, up

                dist = Math.max(...results.size) * 2

                console.log(`dist: ${dist}`)
                eye = [0, 0, -dist]
                target = [0, 0, 0]
                up = [0, 1, 0]

                {
                    // matrix_view_world = mat4.create()
                    // mat4.lookAt(matrix_view_world, eye, target, up)
                    // console.log(`matrix_view_world:`, matrix_view_world)

                    // matrix_view = mat4.create()
                    // mat4.invert(matrix_view, matrix_view_world)
                    matrix_view = mat4.create()
                    mat4.lookAt(matrix_view, eye, target, up)
                    // console.log(`matrix_view:`, matrix_view)
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
        vertex3DCodePath = `vertex3D.wgsl`
        fragmentCodePath = `fragment.wgsl`
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
        });

        recreateRenderTargets = () => {
            MSAATexture?.destroy?.();
            colorAccumTexture?.destroy?.();
            colorResolvedTexture?.destroy?.();
            depthTexture?.destroy?.();
            alphaAccumTexture?.destroy?.();
            alphaResolvedTexture?.destroy?.();

            const size = [canvas.width, canvas.height];

            MSAATexture = device.createTexture({
                size,
                format: canvasFormat,
                sampleCount: 4,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            });

            colorAccumTexture = device.createTexture({
                size,
                format: canvasFormat,
                sampleCount: 4,
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });

            colorResolvedTexture = device.createTexture({
                size,
                format: canvasFormat,
                sampleCount: 1,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            });

            depthTexture = device.createTexture({
                size,
                format: `depth24plus`,
                sampleCount: 4,
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });

            alphaAccumTexture = device.createTexture({
                size,
                format: `rgba16float`,
                sampleCount: 4,
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });

            alphaResolvedTexture = device.createTexture({
                size,
                format: `rgba16float`,
                sampleCount: 1,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            });

            compositeBindGroup = device.createBindGroup({
                layout: compositeBindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: colorResolvedTexture.createView(),
                    },
                    {
                        binding: 1,
                        resource: alphaResolvedTexture.createView(),
                    },
                ],
            });
        };

        recreateRenderTargets();
    }

    {
        resizeTimelineGPU = () => {
            const changed = resizeCanvasBackingStore();

            if (!changed) return;

            updateProjectionForResize();
            recreateRenderTargets();
        };

        const timelineResizeObserver = new ResizeObserver(() => {
            resizeTimelineGPU();
        });

        timelineResizeObserver.observe(canvas);

        window.addEventListener("resize", resizeTimelineGPU);

        // 等 CSS / grid / --u 完成布局后再检查一次
        requestAnimationFrame(resizeTimelineGPU);
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
    let lastX = null;
    deltaAngle = 0
    scrollSpeed = 0.01
    rangeAngle = [-10, 10]

    const MAX_SCROLL_PIXELS_PER_FRAME = 90;
    const MAX_SCROLL_SPEED = 20;

    function consumeTimelineScrollQueue() {
        if (Math.abs(timelineScrollPixels) < 0.01) {
            timelineScrollPixels = 0;
            return;
        }

        const take =
            Math.sign(timelineScrollPixels) *
            Math.min(Math.abs(timelineScrollPixels), MAX_SCROLL_PIXELS_PER_FRAME);

        timelineScrollPixels -= take;

        deltaAngle -= take * scrollSpeed;

        deltaAngle = Math.max(
            -MAX_SCROLL_SPEED,
            Math.min(MAX_SCROLL_SPEED, deltaAngle)
        );
    }

    {
        yaw = 0
        canvas.addEventListener(`mousemove`, (e) => {
            if (e.buttons == 1) {
                yaw += e.movementX * 0.005
                // console.log(`yaw:`, yaw)
            }
        })

        // 把所有鼠标位移统一进队列，逐帧消化
        let pending = 0;
        let animating = false;

        const speed = 0.00035;   // 像素 → 弧度 的比例
        const maxPerFrame = 75;  // 每帧最多消化多少像素（平滑关键参数）
        const minYaw = 0;
        const maxYaw = Math.PI / 6;

        function clamp(v, lo, hi) {
            return Math.max(lo, Math.min(hi, v));
        }

        function step() {
            if (Math.abs(pending) < 0.01) { // 足够小就停
                pending = 0;
                animating = false;
                return;
            }

            // 本帧拿一小口像素量来转
            const take = Math.sign(pending) * Math.min(Math.abs(pending), maxPerFrame);
            pending -= take;

            // 方向：向右移动 → yaw 减小（你之前的反向规则）
            yaw -= take * speed;
            yaw = clamp(yaw, minYaw, maxYaw);

            requestAnimationFrame(step);
        }

        function kick() {
            if (!animating) {
                animating = true;
                requestAnimationFrame(step);
            }
        }

        document.body.addEventListener('mousemove', (e) => {
            if (lastX !== null) {
                const dx = e.clientX - lastX;

                // 统一进队列；想“只对>100的做平滑”也行：
                // if (Math.abs(dx) > 100) pending += dx; else yaw -= dx * speed;
                pending += dx;

                kick();
            }
            lastX = e.clientX;
        });

        document.body.addEventListener('mouseleave', () => {
            lastX = null; // 防止回到页面时第一下跳变
        });
        // // update your global model→world transform first:
        // globalRotate = mat4.create();
        // mat4.fromYRotation(globalRotate, yaw);
        // const worldMatrix = mat4.create();
        // mat4.multiply(worldMatrix, globalRotate, matrix_transform);
        // device.queue.writeBuffer(transformStorageBuffer, 0, new Float32Array(worldMatrix));

        window.addEventListener(`wheel`, (event) => {
            if (event.target.closest('.hotzone-list')) return;

            queueTimelineScroll(event.deltaY);
        });

        const hotzoneList = document.querySelector('.hotzone-list');

        hotzoneList.addEventListener('wheel', (event) => {
            event.preventDefault();
            event.stopPropagation();

            hotzoneList.scrollLeft += event.deltaY;
        }, { passive: false });

        const timelineBelt = document.querySelector("div.timelineBelt");

        let timelineTouchActive = false;
        let timelineTouchLastY = 0;
        let timelineTouchMoved = false;
        let suppressTimelineClickUntil = 0;

        const TOUCH_SCROLL_MULTIPLIER = 2.2;

        timelineBelt?.addEventListener("pointerdown", (event) => {
            if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
            if (event.isPrimary === false) return;

            timelineTouchActive = true;
            timelineTouchMoved = false;
            timelineTouchLastY = event.clientY;

            timelineBelt.setPointerCapture?.(event.pointerId);

            event.preventDefault();
        }, { passive: false });

        timelineBelt?.addEventListener("pointermove", (event) => {
            if (!timelineTouchActive) return;

            const dy = event.clientY - timelineTouchLastY;

            if (Math.abs(dy) > 1) {
                queueTimelineScroll(dy * TOUCH_SCROLL_MULTIPLIER);

                if (Math.abs(dy) > 4) {
                    timelineTouchMoved = true;
                }
            }

            timelineTouchLastY = event.clientY;

            event.preventDefault();
        }, { passive: false });

        function endTimelineTouch(event) {
            if (!timelineTouchActive) return;

            timelineTouchActive = false;

            if (timelineTouchMoved) {
                suppressTimelineClickUntil = performance.now() + 350;
            }

            timelineBelt?.releasePointerCapture?.(event.pointerId);
        }

        timelineBelt?.addEventListener("pointerup", endTimelineTouch);
        timelineBelt?.addEventListener("pointercancel", endTimelineTouch);
        timelineBelt?.addEventListener("pointerleave", endTimelineTouch);

        // 防止拖动年份牌之后，又误触发 li click
        timelineBelt?.addEventListener("click", (event) => {
            if (performance.now() > suppressTimelineClickUntil) return;

            event.preventDefault();
            event.stopPropagation();
        }, true);
    }
    const wheelResistance = () => {
        if (Math.abs(deltaAngle) < 0.01) {
            deltaAngle = 0
            return
        }
        deltaAngle *= 0.95  // 每帧逐渐衰减
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
            //     console.log(`state.angle.rx:`, state.angle.rx)
            // }

            modelTransformMatrix = modelTransform(
                mat4.create(), group.center,
                [state.angle.rx, state.angle.ry, state.angle.rz],
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

    let render,
        y_top, y_bottom, y_top_change, y_bottom_change,
        z_left, z_right, z_middle,
        circleCenter, circleRadius, circumference

    y_top = 43.06108856201172 - 0.005 / 0.0254
    y_bottom = -4.872117042541504 + 0.005 / 0.0254
    y_top_change = 36.811031341552734
    y_bottom_change = 1.377947449684143
    z_left = -37.759029388427734 + 0.005 / 0.0254
    z_right = -25.258892059326172 - 0.005 / 0.0254
    z_middle = -31.50895881652832
    circleRadius = (Math.abs(y_top - y_top_change) + Math.abs(y_bottom - y_bottom_change) + Math.abs(z_left - z_middle) + Math.abs(z_right - z_middle)) / 4

    // top - top_change: 6.0532068267581985984251968503937
    // bottom - bottom_change: -6.0532140985248595984251968503937
    // left - middle: -6.0532201781986265984251968503937
    // right - middle: 6.0532163635013605984251968503937
    render = async (deltaTime) => {
        // === Control 3D components (Rotate, translate, and scale) ===
        {
            let r, d,
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



            // circleCenter = [
            //     { y: y_top_change, z: z_middle },
            //     { y: y_bottom_change, z: z_middle },
            // ];
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
                // if (index == 1) {
                // state.time = (state.time || 0) + deltaTime
                if ((state.translation.y + state.center.y >= y_bottom) && (state.translation.y + state.center.y <= y_top)) {
                    if (state.translation.y + state.center.y > y_top_change) {
                        // console.log(1)
                        state.angle.rx += deltaAngleRad
                        state.direction.y = Math.cos(state.angle.rx - state.deltaAngle.rx)
                        if (state.translation.y + d.y * state.direction.y + state.center.y >= y_top) {
                            // console.log(1.1)
                            state.direction.y = 0
                        }
                        // state.translation.y += d.y * state.direction.y
                        state.direction.z = Math.sin(state.angle.rx - state.deltaAngle.rx)
                    } else if (state.translation.y + state.center.y < y_bottom_change) {
                        // console.log(2)
                        state.angle.rx += deltaAngleRad
                        state.direction.y = Math.cos(state.angle.rx - state.deltaAngle.rx)
                        if (state.translation.y + d.y * state.direction.y + state.center.y <= y_bottom) {
                            // console.log(2.1)
                            state.direction.y = 0
                        }
                        // state.translation.y += d.y * state.direction.y
                        state.direction.z = Math.sin(state.angle.rx - state.deltaAngle.rx)
                    } else {
                        // console.log(3)
                        if (state.translation.z + state.center.z >= z_middle) {
                            // console.log(3.1)
                            state.angle.rx = Math.PI / 180 * 180 + state.deltaAngle.rx
                            // state.translation.y += d.y * state.direction.y
                            state.translation.z = z_right - state.center.z
                            state.direction.y = -1
                        } else {
                            // console.log(3.2)
                            state.angle.rx = Math.PI / 180 * 0 + state.deltaAngle.rx
                            // state.translation.y += d.y * state.direction.y
                            state.translation.z = z_left - state.center.z
                            state.direction.y = 1
                        }
                    }
                } else {
                    // console.log(4)
                    // if (state.translation.y + state.center.y > y_top) {
                    //     console.log(4.1)
                    //     state.translation.y = y_top - state.center.y
                    //     state.angle.rx = Math.PI / 180 * 90 + state.deltaAngle.rx
                    //     state.direction.y = Math.cos(state.angle.rx - state.deltaAngle.rx)
                    //     state.direction.z = 0
                    // } else if (state.translation.y + state.center.y < y_bottom) {
                    //     console.log(4.2)
                    //     state.translation.y = y_bottom - state.center.y
                    //     state.angle.rx = Math.PI / 180 * 270 + state.deltaAngle.rx
                    //     state.direction.y = Math.cos(state.angle.rx - state.deltaAngle.rx)
                    //     state.direction.z = 0
                    // }
                }
                state.translation.y += d.y * state.direction.y
                state.translation.z += d.z * state.direction.z

                let moved
                moved = d.y * state.direction.y !== 0 || d.z * state.direction.z !== 0
                if (moved) {
                    state.frameCount = (state.frameCount || 0) - deltaAngle
                }
                // console.log(`state.frameCount:totalFrames:`, state.frameCount, `:`, totalFrames)
                if (state.frameCount >= totalFrames || state.frameCount <= -totalFrames || state.frameCount == 0) {
                    // console.log(`correct ${index}:`, state.frameCount, totalFrames)
                    state.translation.y = 0
                    state.translation.z = 0
                    state.angle.rx = 0
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
            matrix_world = mat4.create()
            mat4.multiply(matrix_world, globalRotate, matrix_transform)
            device.queue.writeBuffer(transformStorageBuffer, 0, matrix_world)
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
    let frame, lastTime, deltaTime
    lastTime = performance.now()
    frame = async (now) => {
        deltaTime = (now - lastTime) / 1000;
        lastTime = now;

        resizeTimelineGPU();

        consumeTimelineScrollQueue();
        wheelResistance();
        render(deltaTime);

        requestAnimationFrame(frame);
    };
    frame()

})

// === export data ===
export async function getData() {
    let data = {
        results: results,
        modelStates: modelStates,
        matrix_view: matrix_view,
        matrix_projection: matrix_projection,
        matrix_transform: matrix_transform,
        matrix_world: matrix_world,
        canvas: canvas,
    }
    // console.log(`data:`, data)
    return data
}
