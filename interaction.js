import { getData } from "./3D_model_3.js";
import { getCoordinates, getRotations } from "./tools/calculate.js"
import { vec3 } from "./node_modules/gl-matrix/esm/index.js"

"use strict";
window.addEventListener("DOMContentLoaded", async () => {
    let frame,
        data, li,
        x, y, z,
        coordinates,
        angle

    li = document.querySelectorAll('li[data-date]');
    angle = {
        local: { rx: 0, ry: 0, rz: 0 },
        global: { rx: 0, ry: 0, rz: 0 },
    }

    frame = async () => {
        data = await getData()
        if (data.results && data.modelStates && data.matrix_view && data.matrix_projection && data.matrix_transform && data.matrix_world && data.canvas) {
            // console.log(`data:`, data)
            li.forEach(async (item, index) => {
                // if (index == 0) {
                x = data.modelStates[index].center.x + data.modelStates[index].translation.x
                y = data.modelStates[index].center.y + data.modelStates[index].translation.y
                z = data.modelStates[index].center.z + data.modelStates[index].translation.z

                coordinates = await getCoordinates([x, y, z], data.matrix_view, data.matrix_projection, data.matrix_world, data.canvas)
                x = coordinates.x
                y = coordinates.y

                Object.assign(item.style, {
                    left: x + 'px',
                    top: y + 'px',
                })

                // 角度单位：度
                angle.global = await getRotations(data.matrix_world);
                angle.local = {
                    rx: (data.modelStates[index].angle.rx - data.modelStates[index].deltaAngle.rx) * 180 / Math.PI,
                    ry: (data.modelStates[index].angle.ry - data.modelStates[index].deltaAngle.ry) * 180 / Math.PI,
                    rz: (data.modelStates[index].angle.rz - data.modelStates[index].deltaAngle.rz) * 180 / Math.PI,
                };

                // const scale = 1 + z * 0.001;
                // const center_world = data.results.center; // [x, y, z]
                const modelPos = vec3.create();
                const a = [data.modelStates[index].translation.x, data.modelStates[index].translation.y, data.modelStates[index].translation.z]
                // const b = [data.modelStates[index].center.x, data.modelStates[index].center.y, data.modelStates[index].center.z]
                const b = [0, 0, 0]
                // console.log(`data.modelStates[index].translation:`, data.modelStates[index].translation, `data.modelStates[index].center:`, data.modelStates[index].center)
                vec3.add(modelPos, a, b); // ✅ 真实世界坐标
                // console.log("world:", modelPos);
                // const center_camera = vec3.create();
                // vec3.transformMat4(center_camera, modelPos, data.matrix_view); // 直接用已有 matrix_view
                // console.log("camera:", center_camera);
                // console.log(`data.matrix_view:`, data.matrix_view)
                // const degX = Math.atan2(center_camera[1], center_camera[2]) * 180 / Math.PI;
                // const degY = -Math.atan2(center_camera[0], center_camera[2]) * 180 / Math.PI;
                // const degZ = Math.atan2(modelPos[0], modelPos[2]) * 180 / Math.PI;
                // console.log(`modelPos_fix:`, (modelPos[1] + 20) * 0.15 * Math.cos(modelPos[2]) * -Math.cos(Math.atan2(modelPos[0], modelPos[2])))

                // // 相机视图下的位置
                // const pos = vec3.create();
                // const modelPos = vec3.create();
                // vec3.transformMat4(pos, modelPos, data.matrix_view); // 得到的是视图空间坐标

                // // 在屏幕空间的朝向向量（从相机朝物体）
                // // console.log(pos[0], pos[1], pos[2])
                // const screenDir = [pos[0], pos[1]];

                // // 计算这个方向相对于“垂直向上” [0, 1] 的夹角
                // const degZ = -Math.atan2(screenDir[0], screenDir[1]) * 180 / Math.PI;
                // console.log(`degZ:`, degZ)

                // const pos = vec3.create(); // 模型世界坐标 → 相机视角
                // vec3.transformMat4(pos, modelPos, data.matrix_view);
                // console.log(`modelPos:`, modelPos[0], modelPos[1], modelPos[2])

                // // 用 x/y 得到绕 Z 轴的视觉偏转角度
                // const degZ = -Math.atan2(pos[0], pos[1]) * 180 / Math.PI;

                //                 // 控制 CSS
                //                 element.style.transform = `
                //   rotateX(...) 
                //   rotateY(...) 
                //   rotateZ(${trueAngleZ + degZ}deg) // 补偿视觉歪斜
                // `;
                // console.log(`degZ:`, degZ)

                // ✅ 你可以控制 CSS 顺序，如先局部再全局：
                item.style.transform = `
                rotateX(${angle.global.rx}deg)
                rotateY(${angle.global.ry}deg)
                rotateZ(${angle.global.rz}deg)
                rotateX(${angle.local.rx}deg)
                rotateY(${angle.local.ry}deg)
                rotateZ(${angle.local.rz}deg)
            `;
                // console.log(`z > data.results.center[2]:`, z > data.results.center[2])
                // if (index == 1) {
                if (data.modelStates[index].center.z + data.modelStates[index].translation.z < data.results.center[2] - 0.5) {
                    item.style.visibility = `initial`
                } else {
                    item.style.visibility = `hidden`
                }
                // }

                // }
            })
        }
        requestAnimationFrame(frame)
    }
    frame()

    let year
    li.forEach((item, index) => {
        console.log(`li:`, item)
        item.addEventListener(`click`, async (event) => {
            year = item.getAttribute('data-date');
            projectShowcase.classList.remove('active');
            await getProjects(year)
        })
    });

    let projectShowcase = document.querySelector('div.projectShowcase');
    let iframeWrappers = document.querySelectorAll(`div.iframe-wrapper`)
    let hotzone = document.querySelector(`div.hotzone`)
    let iframeMasks = document.querySelectorAll(`div.iframe-mask`)
    const bindIframeEvents = () => {
        projectShowcase = document.querySelector('div.projectShowcase');
        iframeWrappers = document.querySelectorAll(`div.iframe-wrapper`);
        hotzone = document.querySelector(`div.hotzone`);
        iframeMasks = document.querySelectorAll(`div.iframe-mask`);

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        hotzone.addEventListener(`mouseover`, () => {
            iframeWrappers.forEach((item) => {
                item.querySelector(`iframe`).style.display = '';
            });
        });

        hotzone.addEventListener(`click`, () => {
            projectShowcase.classList.remove('active');
            hotzone.style.pointerEvents = `none`;
            setTimeout(() => {
                hotzone.style.pointerEvents = `initial`;
            }, 500);

            iframeWrappers.forEach((wrapper) => {
                wrapper.classList.remove(`active`);
                wrapper.style.pointerEvents = `none`;
                setTimeout(() => {
                    wrapper.style.pointerEvents = `initial`;
                }, 500);
            });
        });

        iframeMasks.forEach((mask, index) => {
            mask.addEventListener(`click`, async () => {
                projectShowcase.classList.add(`active`);
                hotzone.style.pointerEvents = `none`;
                setTimeout(() => {
                    hotzone.style.pointerEvents = `initial`;
                }, 2000);

                for (let i = iframeWrappers.length - 1; i >= 0; i--) {
                    iframeWrappers[i].classList.add(`active`);
                    await sleep(200);
                }
            });
        });
    };

    bindIframeEvents()

    // let i = 0
    // setInterval(() => {
    //     iframeWrappers[6].querySelector(`iframe`).src = `https://www.hrjlhy.com/Beijing%20Human%20Resource%20Service%20Industry%20Association/sign_in(` + (i % 4 + 1) + `).html`
    //     i++
    // }, 2500);

    const renderProjects = (projects) => {
        const hotzone = document.querySelector('.hotzone');
        const playzone = document.querySelector('.playzone');

        // ✅ 清空
        hotzone.innerHTML = '';
        playzone.innerHTML = '';

        projects.forEach(({ name, URLs }) => {
            const firstURL = URLs?.[0] || 'about:blank';
            const isMobile = name.trim().endsWith('(mobile)');
            const iframeClass = isMobile ? 'projectShowcase mobile' : 'projectShowcase';

            playzone.insertAdjacentHTML('beforeend', `
            <div class="iframe-wrapper">
                <iframe class="${iframeClass}" src="${firstURL}" frameborder="0" tabindex="0"></iframe>
                <div class="iframe-mask"></div>
            </div>
        `);

            hotzone.insertAdjacentHTML('beforeend', `
            <div class="hotzone-label">${name}</div>
        `);
        });

        // ✅ 重新绑定事件
        bindIframeEvents();
    };

    const ws = new WebSocket(`wss://localhost:443`)
    ws.onopen = () => {
        console.log('✅ Connected to server');
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'projects') {
            console.log(`📦 Projects in ${msg.year}:`, msg.data);
            // 示例输出格式: [{ name: "...", urls: [...] }, ...]
            renderProjects(msg.data.reverse())
        }
    };

    const getProjects = async (year) => {
        ws.send(JSON.stringify({
            type: 'projects',
            ...(year ? { year } : {}) // 如果有 year 就发送 year，没有就不发送
        }));
    };

})