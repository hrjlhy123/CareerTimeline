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
        // console.log(`li:`, item)
        item.addEventListener(`click`, async (event) => {
            year = item.getAttribute('data-date');
            projectShowcase.classList.remove('active');
            await getProjects(year)
            // random num
            {
                const now = Date.now();
                const rand = (now % 1000) / 1000; // 平均落在 [0,1]

                document.body.style.setProperty("--rand-global", rand.toFixed(3));
            }
        })
    });

    let projectShowcase = document.querySelector('div.projectShowcase')
    let hotzone = document.querySelector(`div.hotzone`)
    let playzone = document.querySelector(`div.playzone`)
    let iframeWrappers = document.querySelectorAll(`div.iframe-wrapper`)
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
            }, 200);

            iframeWrappers.forEach((wrapper, i) => {
                iframeWrappers[i].classList.remove(`active`);
                iframeWrappers[i].querySelector(`iframe`).classList.remove(`show`)
                iframeWrappers[i].style.pointerEvents = `none`;
                setTimeout(() => {
                    iframeWrappers[i].style.pointerEvents = `initial`;
                }, 500);
            });
        });

        let animating = false

        iframeMasks.forEach((mask, index) => {
            mask.addEventListener(`click`, async () => {
                if (animating) return;        // 防止重复点击
                animating = true;

                projectShowcase.classList.add(`active`);
                // hotzone.style.pointerEvents = `none`;
                // setTimeout(() => {
                //     hotzone.style.pointerEvents = `initial`;
                // }, 2000);

                for (let i = iframeWrappers.length - 1; i >= 0; i--) {
                    iframeWrappers[i].classList.add(`active`);
                    await sleep(200);
                    setTimeout(() => {
                        iframeWrappers[i].querySelector(`iframe`).classList.add(`show`)
                    }, 150);
                }

                animating = false;
            });
        });
    };

    bindIframeEvents()

    // let i = 0
    // setInterval(() => {
    //     iframeWrappers[6].querySelector(`iframe`).src = `https://www.hrjlhy.com/Beijing%20Human%20Resource%20Service%20Industry%20Association/sign_in(` + (i % 4 + 1) + `).html`
    //     i++
    // }, 2500);

    const applyStackVars = (playzone, maxN = 10) => {
        // 只取已激活的
        const items = Array.from(playzone.querySelectorAll('.iframe-wrapper'));
        const total = items.length;
        playzone.style.setProperty('--count', total);

        // 根据 maxN 动态计算 step-left
        const step = 20 / maxN;
        playzone.style.setProperty('--step-left', `${step}%`);

        // 只让“最后 maxN 个”参与叠放
        const start = Math.max(0, total - maxN);
        const visible = items.slice(start);

        // 右→左编号：最右 i=1
        visible.reverse().forEach((el, i) => {
            el.style.setProperty('--i', i + 1);
        });

        // 清掉前面被“忽略”的
        items.slice(0, start).forEach(el => el.style.removeProperty('--i'));
    };

    const renderProjects = (year, projects) => {
        const hotzoneList = document.querySelector('.hotzone-list');
        const playzone = document.querySelector('.playzone');

        if (year != `all`) {
            // ✅ 清空
            hotzoneList.innerHTML = '';
            playzone.innerHTML = '';

            playzone.setAttribute("data-date", year);
            projects.forEach(({ name, URLs }) => {
                const firstURL = URLs?.[0] || 'about:blank';
                const isMobile = name.trim().endsWith('(mobile)');
                const iframeClass = isMobile ? 'projectShowcase mobile' : 'projectShowcase';

                hotzoneList.insertAdjacentHTML('beforeend', `<li></li>`)
                hotzoneList.lastElementChild.textContent = name;

                playzone.insertAdjacentHTML('beforeend', `
            <div class="iframe-wrapper">
                <iframe class="${iframeClass}" src="${firstURL}" frameborder="0" tabindex="0"></iframe>
                <div class="iframe-mask"></div>
            </div>
        `);
            });

            applyStackVars(playzone, projects.length);

        } else {
            projects.forEach(({ name, URLs }) => {
                hotzoneList.insertAdjacentHTML('beforeend', `<li></li>`)
                hotzoneList.lastElementChild.textContent = name;
            })
        }
        // ✅ 重新绑定事件
        bindIframeEvents();
    };

    const ws = new WebSocket(`wss://localhost:443`)
    ws.onopen = () => {
        console.log('✅ Connected to server');
        getProjects()
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'projects') {
            console.log(`📦 Projects in ${msg.year}:`, msg.data);
            // 示例输出格式: [{ name: "...", urls: [...] }, ...]
            renderProjects(msg.year, msg.data.reverse())
        }
    };

    const getProjects = async (year) => {
        ws.send(JSON.stringify({
            type: 'projects',
            ...(year ? { year } : {}) // 如果有 year 就发送 year，没有就不发送
        }));
    };


    /* Unsupervised AI content */

    (() => {
        const RIGHT_ZONE = 0.5;          // 右侧触发阈值
        const TTL_BASE = 4200;         // 基础 TTL
        const TTL_JITTER = 2000;         // 0~2000ms 随机
        const MAX = 7;            // 同屏最多

        const email = "hrjlhy@gmail.com";
        const phone = "+1 (206) 551-4288";

        const MESSAGES = [
            { type: 'text', text: "My name is Jack Hao." },
            { type: 'text', text: "Let's talk if you're interested." },
            { type: 'text', text: "Seeking employment in the US" },
            { type: 'text', text: "Open to full-time opportunities." },
            { type: 'text', text: "Seeking sponsorship for the green card." },
            { type: 'text', text: "3-year OPT after June 2026." },
            { type: 'text', text: "I can play Age of Empires IV." },
            { type: 'email', text: email },
            { type: 'phone', text: phone }
        ];

        const holes = new Set();
        const states = new Map(); // el -> {x,y,r, t0, ax1.., up, timerId, dieAt, remaining, hover, mx,my}

        hotzone.addEventListener('click', e => {
            if (e.clientX < innerWidth * RIGHT_ZONE) return;
            spawnHole(e.clientX, e.clientY);
        });

        function spawnHole(x, y) {
            if (holes.size >= MAX) {
                const oldest = holes.values().next().value;
                removeHole(oldest);
            }

            const r = 56 + (120 - 56) * Math.pow(Math.random(), 0.35); // 偏大分布

            const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

            const hole = document.createElement('div');
            hole.className = 'hole';
            hole.style.setProperty('--x', x + 'px');
            hole.style.setProperty('--y', y + 'px');
            hole.style.setProperty('--r', r + 'px');

            // 一行内容
            let lineHTML = '';
            if (msg.type === 'email') {
                lineHTML = `<span>Email: </span><a class="btn" href="mailto:${msg.text}">${msg.text}</a>`;
            } else if (msg.type === 'phone') {
                const tel = msg.text.replace(/[^+\d]/g, '');
                lineHTML = `<span>Phone: </span><a class="btn" href="tel:${tel}">${msg.text}</a>`;
            } else {
                lineHTML = `${escapeHTML(msg.text)}`;
            }
            hole.innerHTML = `<div class="inner"><p class="line">${lineHTML}</p></div>`;

            document.body.appendChild(hole);
            holes.add(hole);

            // 随机运动参数
            const now = performance.now();
            const ttl = TTL_BASE + Math.floor(Math.random() * TTL_JITTER);
            const st = {
                x, y, r,
                t0: now,
                ax1: rnd(3, 9), ax2: rnd(1, 5),
                ay1: rnd(2, 8), ay2: rnd(1, 4),
                fx1: rnd(0.3, 0.7), fx2: rnd(0.9, 1.6),
                fy1: rnd(0.4, 0.9), fy2: rnd(1.0, 1.8),
                p1: rnd(0, Math.PI * 2), p2: rnd(0, Math.PI * 2),
                p3: rnd(0, Math.PI * 2), p4: rnd(0, Math.PI * 2),
                up: rnd(10, 22),
                hover: false, mx: x, my: y,
                dieAt: now + ttl, remaining: ttl, timerId: null,
                // NEW:
                anchorX: 0, anchorY: 0,
                lastTx: 0, lastTy: 0
            };
            st.timerId = setTimeout(() => removeHole(hole), ttl);
            states.set(hole, st);

            requestAnimationFrame(() => hole.classList.add('show'));

            // 悬停控制：暂停/恢复 TTL + 鼠标跟随
            const onEnter = (ev) => {
                const s = states.get(hole); if (!s) return;
                s.hover = true;
                s.mx = ev.clientX; s.my = ev.clientY;
                // 暂停 TTL
                const t = performance.now();
                s.remaining = Math.max(0, s.dieAt - t);
                if (s.timerId) { clearTimeout(s.timerId); s.timerId = null; }
            };
            const onMove = (ev) => {
                const s = states.get(hole); if (!s || !s.hover) return;
                s.mx = ev.clientX; s.my = ev.clientY;
            };
            const onLeave = () => {
                const s = states.get(hole); if (!s) return;
                s.hover = false;

                // NEW: 用当前最后一帧的位置作为新的起点，并重置时间
                s.anchorX = s.lastTx;
                s.anchorY = s.lastTy;
                s.t0 = performance.now();

                // 恢复 TTL
                if (s.remaining > 0 && !s.timerId) {
                    s.dieAt = performance.now() + s.remaining;
                    s.timerId = setTimeout(() => removeHole(hole), s.remaining);
                }
            };
            hole.addEventListener('mouseenter', onEnter);
            hole.addEventListener('mousemove', onMove);
            hole.addEventListener('mouseleave', onLeave);

            // 清理
            hole.addEventListener('transitionend', () => {
                if (hole.classList.contains('hide')) {
                    hole.remove();
                    holes.delete(hole);
                    const s = states.get(hole);
                    if (s?.timerId) clearTimeout(s.timerId);
                    states.delete(hole);
                }
            });

            kick();
        }

        function removeHole(h) {
            h.classList.add('hide');
        }

        // RAF：更新每个泡泡的 --float（translate）
        let raf = 0;
        function kick() { if (!raf) raf = requestAnimationFrame(loop); }
        function loop(now) {
            raf = 0;
            for (const el of holes) {
                const s = states.get(el);
                if (!s || el.classList.contains('hide')) continue;

                const t = (now - s.t0) / 1000;

                let tx, ty;
                if (!s.hover) {
                    const jitterX = s.ax1 * Math.sin(s.fx1 * t + s.p1)
                        + s.ax2 * Math.sin(s.fx2 * t + s.p2);
                    const jitterY = s.ay1 * Math.sin(s.fy1 * t + s.p3)
                        + s.ay2 * Math.sin(s.fy2 * t + s.p4);
                    // NEW: 从锚点继续
                    tx = s.anchorX + jitterX;
                    ty = s.anchorY + jitterY - (s.up * t);
                } else {
                    const dx = s.mx - s.x;
                    const dy = s.my - s.y;
                    let bx = dx * 0.05, by = dy * 0.05;             // 你的吸附力度
                    const amp = Math.min(14, s.r * 0.35);
                    bx += amp * Math.sin(s.fx1 * t + s.p1) * 0.6;
                    by += amp * Math.sin(s.fy1 * t + s.p3) * 0.6;
                    const maxLen = Math.max(0, s.r - 6);
                    const len = Math.hypot(bx, by) || 1;
                    const k = Math.min(1, maxLen / len);
                    tx = bx * k;
                    ty = by * k;
                }

                // 应用 & 记录当前位置（NEW）
                el.style.setProperty('--float', `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`);
                s.lastTx = tx;
                s.lastTy = ty;
            }
            if (holes.size) kick();
        }

        // utils
        const rnd = (min, max) => Math.random() * (max - min) + min;
        function escapeHTML(s) {
            return s.replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));
        }
    })();
})