import { getData } from "./3D_model_3.js";
import { getCoordinates, getRotations } from "./tools/calculate.js"

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

                item.style.transform = `
                rotateX(${angle.global.rx}deg)
                rotateY(${angle.global.ry}deg)
                rotateZ(${angle.global.rz}deg)
                rotateX(${angle.local.rx}deg)
                rotateY(${angle.local.ry}deg)
                rotateZ(${angle.local.rz}deg)
            `;

                if (data.modelStates[index].center.z + data.modelStates[index].translation.z < data.results.center[2] - 0.5) {
                    item.style.visibility = `initial`
                } else {
                    item.style.visibility = `hidden`
                }

            })
        }
        requestAnimationFrame(frame)
    }
    frame()


    let projectShowcase = document.querySelector('div.projectShowcase')
    let hotzone = document.querySelector(`div.hotzone`)
    let playzone = document.querySelector(`div.playzone`)
    let iframeWrappers = document.querySelectorAll(`div.iframe-wrapper`)
    let iframeMasks = document.querySelectorAll(`div.iframe-mask`)

    let year
    li.forEach((item, index) => {
        item.addEventListener(`click`, async (event) => {
            item.parentNode.querySelectorAll('.checked').forEach(el => el.classList.remove('checked'));
            item.classList.add('checked');
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

    /* Unsupervised AI content */
    // —— 全局轮播管理 —— //
    const _IFRAME_ROTATORS = new Set();

    function _clearAllRotators() {
        for (const r of _IFRAME_ROTATORS) {
            if (r.firstTimeout) clearTimeout(r.firstTimeout);
            if (r.intervalId) clearInterval(r.intervalId);
        }
        _IFRAME_ROTATORS.clear();
    }

    function _attachRotator(iframe, urls, delay = 5000, jitter = 800) {
        const list = (urls || []).filter(Boolean);
        if (list.length <= 1) return; // 只有一个 URL 就不轮播

        let i = 0;
        iframe.dataset.urlIndex = '0';

        const tick = () => {
            i = (i + 1) % list.length;
            iframe.src = list[i];
            iframe.dataset.urlIndex = String(i);
        };

        const rot = { firstTimeout: null, intervalId: null };

        // 首次切换稍微随机一下，避免所有同时换
        const firstDelay = Math.floor(Math.random() * jitter);
        rot.firstTimeout = setTimeout(() => {
            tick();
            rot.intervalId = setInterval(tick, delay);
        }, firstDelay);

        // 悬停暂停 / 离开继续
        const pause = () => {
            if (rot.firstTimeout) { clearTimeout(rot.firstTimeout); rot.firstTimeout = null; }
            if (rot.intervalId) { clearInterval(rot.intervalId); rot.intervalId = null; }
        };
        const resume = () => {
            if (!rot.intervalId) rot.intervalId = setInterval(tick, delay);
        };
        iframe.addEventListener('mouseenter', pause);
        iframe.addEventListener('mouseleave', resume);

        // 记录并在外部可统一清理
        _IFRAME_ROTATORS.add(rot);
    }

    const renderProjects = (year, projects) => {
        const hotzoneList = document.querySelector('.hotzone-list');
        const playzone = document.querySelector('.playzone');

        _clearAllRotators()

        if (year != `all`) {
            // ✅ 清空
            hotzoneList.innerHTML = '';
            playzone.innerHTML = '';

            playzone.setAttribute("data-date", year);
            projects.forEach(({ name, URLs }) => {
                const firstURL = URLs?.[0] || 'about:blank';
                const isMobile = name.trim().endsWith('(mobile)');
                const iframeClass = isMobile ? 'projectShowcase mobile' : 'projectShowcase';

                hotzoneList.insertAdjacentHTML('beforeend', `<li><span class="project-label"></span></li>`)
                hotzoneList.lastElementChild.lastElementChild.textContent = name;
                hotzoneList.lastElementChild.lastElementChild.dataset.text = name;

                playzone.insertAdjacentHTML('beforeend', `
            <div class="iframe-wrapper">
                <iframe class="${iframeClass}" src="${firstURL}" frameborder="0" tabindex="0"></iframe>
                <div class="iframe-mask"></div>
            </div>
                `);

                // 给刚插入的 iframe 开启轮播
                const wrapper = playzone.lastElementChild;
                const iframeEl = wrapper.querySelector('iframe');
                _attachRotator(iframeEl, URLs, 4000); // 这里的 5000 就是 5 秒
            });



            applyStackVars(playzone, projects.length);

        } else {
            hotzoneList.innerHTML = '';
            projects.forEach(({ name, URLs }) => {
                hotzoneList.insertAdjacentHTML('beforeend', `<li><span class="project-label"></span></li>`)
                hotzoneList.lastElementChild.lastElementChild.textContent = name;
                hotzoneList.lastElementChild.lastElementChild.dataset.text = name;
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

    const getProjects = (year) => {
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
            { type: 'text', text: "Self-driven and creative." },
            { type: 'text', text: "Let's talk if you're interested." },
            { type: 'text', text: "Working with WebGPU." },
            { type: 'text', text: "Open to full-time opportunities." },
            { type: 'text', text: "Seeking green card sponsorship." },
            { type: 'text', text: "3-year OPT after June 2026." },
            { type: 'text', text: "Play Age of Empires IV." },
            { type: 'email', text: email },
            { type: 'phone', text: phone }
        ];

        const bubbles = new Set();
        const states = new Map(); // el -> {x,y,r, t0, ax1.., up, timerId, dieAt, remaining, hover, mx,my}

        hotzone.addEventListener('click', e => {
            if (e.clientX < innerWidth * RIGHT_ZONE) return;
            spawnHole(e.clientX, e.clientY);
        });

        function spawnHole(x, y) {
            if (bubbles.size >= MAX) {
                const oldest = bubbles.values().next().value;
                removeHole(oldest);
            }

            const r = 56 + (120 - 56) * Math.pow(Math.random(), 0.35); // 偏大分布

            const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.style.setProperty('--x', x + 'px');
            bubble.style.setProperty('--y', y + 'px');
            bubble.style.setProperty('--r', r + 'px');

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
            bubble.innerHTML = `<div class="inner"><p class="line">${lineHTML}</p></div>`;

            document.body.appendChild(bubble);
            bubbles.add(bubble);

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
            st.timerId = setTimeout(() => removeHole(bubble), ttl);
            states.set(bubble, st);

            requestAnimationFrame(() => bubble.classList.add('show'));

            // 悬停控制：暂停/恢复 TTL + 鼠标跟随
            const onEnter = (ev) => {
                const s = states.get(bubble); if (!s) return;
                s.hover = true;
                s.mx = ev.clientX; s.my = ev.clientY;
                // 暂停 TTL
                const t = performance.now();
                s.remaining = Math.max(0, s.dieAt - t);
                if (s.timerId) { clearTimeout(s.timerId); s.timerId = null; }
            };
            const onMove = (ev) => {
                const s = states.get(bubble); if (!s || !s.hover) return;
                s.mx = ev.clientX; s.my = ev.clientY;
            };
            const onLeave = () => {
                const s = states.get(bubble); if (!s) return;
                s.hover = false;

                // NEW: 用当前最后一帧的位置作为新的起点，并重置时间
                s.anchorX = s.lastTx;
                s.anchorY = s.lastTy;
                s.t0 = performance.now();

                // 恢复 TTL
                if (s.remaining > 0 && !s.timerId) {
                    s.dieAt = performance.now() + s.remaining;
                    s.timerId = setTimeout(() => removeHole(bubble), s.remaining);
                }
            };
            bubble.addEventListener('mouseenter', onEnter);
            bubble.addEventListener('mousemove', onMove);
            bubble.addEventListener('mouseleave', onLeave);

            // 清理
            bubble.addEventListener('transitionend', () => {
                if (bubble.classList.contains('hide')) {
                    bubble.remove();
                    bubbles.delete(bubble);
                    const s = states.get(bubble);
                    if (s?.timerId) clearTimeout(s.timerId);
                    states.delete(bubble);
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
            for (const el of bubbles) {
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
            if (bubbles.size) kick();
        }

        // utils
        const rnd = (min, max) => Math.random() * (max - min) + min;
        function escapeHTML(s) {
            return s.replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));
        }
    })();

    function initProjectCellBlob() {
        const host = document.querySelector(".projectList");
        const list = host?.querySelector(".hotzone-list");

        if (!host || !list) return;
        if (host.querySelector(".project-cell-blob")) return;

        // Wrap li text so the blob can target the actual text area more accurately.
        for (const li of list.querySelectorAll("li")) {
            if (!li.querySelector(".project-label")) {
                const label = document.createElement("span");
                label.className = "project-label";

                while (li.firstChild) {
                    label.appendChild(li.firstChild);
                }

                li.appendChild(label);
            }
        }

        const blob = document.createElement("span");
        blob.className = "project-cell-blob";
        blob.setAttribute("aria-hidden", "true");
        host.prepend(blob);

        const config = {
            stiffness: 0.075, // smaller = slower
            damping: 0.7,    // larger = more elastic
        };

        const state = {
            x: 0,
            y: 0,
            w: 0,
            h: 0,
            vx: 0,
            vy: 0,
            vw: 0,
            vh: 0,
        };

        const target = {
            x: 0,
            y: 0,
            w: 0,
            h: 0,
        };

        let activeLi = null;
        let initialized = false;
        let visible = false;
        let rafId = 0;

        const clamp = (value, min, max) => {
            return Math.min(Math.max(value, min), max);
        };

        function springValue(current, velocity, destination) {
            velocity += (destination - current) * config.stiffness;
            velocity *= config.damping;
            current += velocity;

            return [current, velocity];
        }

        function setTargetFromLi(li) {
            const targetElement = li.querySelector(".project-label") || li;
            const liRect = targetElement.getBoundingClientRect();
            const hostRect = host.getBoundingClientRect();

            const paddingX = 8;
            const paddingY = 8;

            target.x = liRect.left - hostRect.left - paddingX / 2 - 38;
            target.y = liRect.top - hostRect.top - paddingY;
            target.w = liRect.width - paddingX * 2 + 38 * 2;
            target.h = liRect.height + paddingY * 2;

            if (!initialized) {
                state.x = target.x;
                state.y = target.y;
                state.w = target.w;
                state.h = target.h;
                initialized = true;
            }
        }

        function renderDroplet() {
            rafId = 0;

            [state.x, state.vx] = springValue(state.x, state.vx, target.x);
            [state.y, state.vy] = springValue(state.y, state.vy, target.y);
            [state.w, state.vw] = springValue(state.w, state.vw, target.w);
            [state.h, state.vh] = springValue(state.h, state.vh, target.h);

            const speed = Math.hypot(state.vx, state.vy);

            const stretchX = clamp(1 + speed * 0.012, 1, 1.22);
            const squashY = clamp(1 - speed * 0.004, 0.88, 1);

            blob.style.width = `${state.w}px`;
            blob.style.height = `${state.h}px`;

            blob.style.transform = `
    translate3d(${state.x}px, ${state.y}px, 0)
    scale(${stretchX}, ${squashY})
  `;

            const distance =
                Math.abs(target.x - state.x) +
                Math.abs(target.y - state.y) +
                Math.abs(target.w - state.w) +
                Math.abs(target.h - state.h);

            const stillMoving =
                distance > 0.35 ||
                Math.abs(state.vx) > 0.25 ||
                Math.abs(state.vy) > 0.25 ||
                Math.abs(state.vw) > 0.25 ||
                Math.abs(state.vh) > 0.25;

            if (visible || stillMoving) {
                rafId = requestAnimationFrame(renderDroplet);
            }
        }

        function start() {
            if (!rafId) {
                rafId = requestAnimationFrame(renderDroplet);
            }
        }

        list.addEventListener("pointerover", (event) => {
            const li = event.target.closest("li");
            if (!li || !list.contains(li)) return;

            activeLi = li;
            visible = true;

            setTargetFromLi(li);
            blob.classList.add("is-visible");

            start();
        });

        list.addEventListener("pointerleave", () => {
            activeLi = null;
            visible = false;
            blob.classList.remove("is-visible");

            start();
        });

        list.addEventListener(
            "scroll",
            () => {
                if (!activeLi) return;

                setTargetFromLi(activeLi);
                start();
            },
            { passive: true }
        );

        window.addEventListener("resize", () => {
            if (!activeLi) return;

            setTargetFromLi(activeLi);
            start();
        });
    }

    initProjectCellBlob();
})