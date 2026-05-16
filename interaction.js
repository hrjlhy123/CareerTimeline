import {
    getData,
    queueTimelineScroll,
    clearTimelineScrollQueue
} from "./3D_model.js";
import { getCoordinates, getRotations } from "./tools/calculate.js"

"use strict";
window.addEventListener("DOMContentLoaded", async () => {

    let frame,
        data, li,
        x, y, z,
        coordinates,
        angle

    let timelineListReady = false;

    li = document.querySelectorAll('ul.timeList > li[data-year]');
    angle = {
        local: { rx: 0, ry: 0, rz: 0 },
        global: { rx: 0, ry: 0, rz: 0 },
    }

    const dom = {
        projectShowcase: document.querySelector("div.projectShowcase"),
        projectList: document.querySelector("div.projectList"),
        iframes: document.querySelector("div.iframes"),
        hotzoneList: document.querySelector(".hotzone-list"),
        backButton: document.querySelector(".project-back-button"),
        backIcon: document.querySelector(".project-back-icon"),
        backLightGradient: document.querySelector("#projectBackLightGradient"),
        metricFills: Array.from(document.querySelectorAll(".metric-fill")),
        title: document.querySelector("div.title > p.title"),
        summary: document.querySelector(".playzone .summary"),
    };

    // Global Illumination

    // const lightDebugDot = document.createElement("div");
    // lightDebugDot.style.cssText = `
    //     position: fixed;
    //     width: 10px;
    //     height: 10px;
    //     border-radius: 999px;
    //     background: red;
    //     z-index: 99999;
    //     pointer-events: none;
    //     transform: translate(-50%, -50%);
    // `;
    // document.body.appendChild(lightDebugDot);

    const pointerLight = {
        x: window.innerWidth * 0.32,
        y: window.innerHeight * 0.12,
        hasPointer: false,
        dirty: true,
    };

    const clamp = (value, min, max) => {
        return Math.min(Math.max(value, min), max);
    };

    function getGlobalLightForElement(el, options = {}) {
        if (!el) return null;

        const rect = el.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) return null;

        const {
            defaultLightX = rect.left + rect.width * 0.32,
            defaultLightY = rect.top + rect.height * 0.12,
            range = 420,
            minInfluence = 0.18,
            xStrength = 30,
            yStrength = 22,
            yBias = -6,
            alphaBase = 0.42,
            alphaInfluence = 0.24,
            alphaExtra = 0,
        } = options;

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const lightSourceX = pointerLight.hasPointer
            ? pointerLight.x
            : defaultLightX;

        const lightSourceY = pointerLight.hasPointer
            ? pointerLight.y
            : defaultLightY;

        const dx = lightSourceX - centerX;
        const dy = lightSourceY - centerY;

        const distance = Math.hypot(dx, dy) || 1;

        const nx = dx / distance;
        const ny = dy / distance;

        const influence = clamp(
            1 - distance / range,
            minInfluence,
            1
        );

        const lightX = clamp(
            50 + nx * xStrength * influence,
            18,
            82
        );

        const lightY = clamp(
            50 + yBias + ny * yStrength * influence,
            14,
            76
        );

        const lightAlpha = clamp(
            alphaBase + influence * alphaInfluence + alphaExtra,
            0.42,
            0.86
        );

        return {
            dx,
            dy,
            distance,
            nx,
            ny,
            influence,
            lightX,
            lightY,
            lightAlpha,
        };
    }

    function updateBackButtonGlobalIllumination() {
        const button = dom.backButton;
        const icon = dom.backIcon;
        const lightGradient = dom.backLightGradient;

        if (!button || !icon || !lightGradient) return;

        const light = getGlobalLightForElement(button, {
            range: 360,
            minInfluence: 0.18,
            xStrength: 34,
            yStrength: 30,
            yBias: -6,
            alphaBase: 0.42,
            alphaInfluence: 0.32,
        });

        if (!light) return;

        // 像年份牌一样：高光点移动，而不是旋转底色
        lightGradient.setAttribute("cx", `${light.lightX.toFixed(1)}%`);
        lightGradient.setAttribute("cy", `${light.lightY.toFixed(1)}%`);
        lightGradient.setAttribute("r", `${(32 + light.influence * 48).toFixed(1)}%`);

        icon.style.setProperty("--back-light-alpha", light.lightAlpha.toFixed(2));

        icon.style.setProperty(
            "--back-light-opacity",
            clamp(0.28 + light.influence * 0.56, 0.28, 0.84).toFixed(2)
        );

        icon.style.setProperty(
            "--back-shadow-alpha",
            clamp(0.10 + light.influence * 0.16, 0.10, 0.26).toFixed(2)
        );

        icon.style.setProperty(
            "--back-accent-alpha",
            clamp(0.58 + light.influence * 0.26, 0.58, 0.84).toFixed(2)
        );
    }

    function updateMetricGlobalIllumination() {
        dom.metricFills.forEach((fill) => {
            const light = getGlobalLightForElement(fill, {
                range: 360,
                minInfluence: 0.12,
                xStrength: 28,
                yStrength: 26,
                yBias: -8,
                alphaBase: 0.24,
                alphaInfluence: 0.34,
            });

            if (!light) return;

            const rect = fill.getBoundingClientRect();

            const lightSourceY = pointerLight.hasPointer
                ? pointerLight.y
                : rect.top + rect.height * 0.18;

            // 用“真实光源高度”决定光斑纵向位置，而不是用 light.lightY
            const localY = clamp(
                (lightSourceY - rect.top) / rect.height,
                -0.25,
                1.25
            );

            const mappedY = clamp(
                localY * 100,
                8,
                92
            );

            // 0 = 顶部/底部，1 = 中部
            const centerFactor = 1 - Math.abs(clamp(localY, 0, 1) - 0.5) * 2;

            const farFactor = 1 - light.influence;

            const lightRx = clamp(
                48 + farFactor * 44 + (1 - centerFactor) * 8,
                42,
                98
            );

            const lightRy = clamp(
                30 + centerFactor * light.influence * 52 + farFactor * 16,
                28,
                86
            );

            const lightAlpha = clamp(
                0.20 + light.influence * 0.36,
                0.20,
                0.62
            );

            fill.style.setProperty("--metric-light-x", `${light.lightX.toFixed(1)}%`);
            fill.style.setProperty("--metric-light-y", `${mappedY.toFixed(1)}%`);
            fill.style.setProperty("--metric-light-rx", `${lightRx.toFixed(1)}%`);
            fill.style.setProperty("--metric-light-ry", `${lightRy.toFixed(1)}%`);
            fill.style.setProperty("--metric-light-alpha", lightAlpha.toFixed(2));
        });
    }

    document.addEventListener("pointermove", (event) => {
        pointerLight.x = event.clientX;
        pointerLight.y = event.clientY;
        pointerLight.hasPointer = true;
        pointerLight.dirty = true;
        // lightDebugDot.style.left = `${event.clientX}px`;
        // lightDebugDot.style.top = `${event.clientY}px`;
    });

    document.addEventListener("pointerleave", () => {
        pointerLight.hasPointer = false;
        pointerLight.dirty = true;
    });

    frame = async () => {
        data = await getData();

        if (
            data.results &&
            data.modelStates &&
            data.matrix_view &&
            data.matrix_projection &&
            data.matrix_transform &&
            data.matrix_world &&
            data.canvas
        ) {
            const angleGlobal = await getRotations(data.matrix_world);
            const beltRect = data.canvas.getBoundingClientRect();

            for (let index = 0; index < li.length; index++) {
                const item = li[index];

                let x =
                    data.modelStates[index].center.x +
                    data.modelStates[index].translation.x;

                let y =
                    data.modelStates[index].center.y +
                    data.modelStates[index].translation.y;

                let z =
                    data.modelStates[index].center.z +
                    data.modelStates[index].translation.z;

                const coordinates = await getCoordinates(
                    [x, y, z],
                    data.matrix_view,
                    data.matrix_projection,
                    data.matrix_world,
                    data.canvas
                );

                x = coordinates.x;
                y = coordinates.y;

                item.style.left = "0";
                item.style.top = "0";

                const angleLocal = {
                    rx:
                        (data.modelStates[index].angle.rx -
                            data.modelStates[index].deltaAngle.rx) *
                        180 /
                        Math.PI,
                    ry:
                        (data.modelStates[index].angle.ry -
                            data.modelStates[index].deltaAngle.ry) *
                        180 /
                        Math.PI,
                    rz:
                        (data.modelStates[index].angle.rz -
                            data.modelStates[index].deltaAngle.rz) *
                        180 /
                        Math.PI,
                };

                item.style.transform = `
                translate3d(${x}px, ${y}px, 0)
                translate3d(-50%, -50%, 0)
                rotateX(${angleGlobal.rx}deg)
                rotateY(${angleGlobal.ry}deg)
                rotateZ(${angleGlobal.rz}deg)
                rotateX(${angleLocal.rx}deg)
                rotateY(${angleLocal.ry}deg)
                rotateZ(${angleLocal.rz}deg)
            `;

                const zFront =
                    data.modelStates[index].center.z +
                    data.modelStates[index].translation.z <
                    data.results.center[2] - 0.5;

                const localRx =
                    data.modelStates[index].angle.rx -
                    data.modelStates[index].deltaAngle.rx;

                const facing = Math.cos(localRx);
                const frontLight = clamp(facing, 0.25, 1);

                const yearLight = getGlobalLightForElement(item, {
                    defaultLightX: beltRect.left + beltRect.width * 0.32,
                    defaultLightY: beltRect.top + beltRect.height * 0.12,
                    range: 420,
                    minInfluence: 0.18,
                    xStrength: 30,
                    yStrength: 22,
                    yBias: -6,
                    alphaBase: 0.42,
                    alphaInfluence: 0.24,
                    alphaExtra: frontLight * 0.12,
                });

                if (yearLight) {
                    item.style.setProperty("--year-light-x", `${yearLight.lightX.toFixed(1)}%`);
                    item.style.setProperty("--year-light-y", `${yearLight.lightY.toFixed(1)}%`);
                    item.style.setProperty("--year-light-alpha", yearLight.lightAlpha.toFixed(2));
                }

                item.style.visibility =
                    zFront && facing > 0.18 ? "initial" : "hidden";
            }

            if (!timelineListReady) {
                document
                    .querySelector("ul.timeList")
                    ?.classList.add("is-ready");

                timelineListReady = true;
            }
        }

        if (pointerLight.dirty) {
            updateBackButtonGlobalIllumination();
            updateMetricGlobalIllumination();
            pointerLight.dirty = false;
        }

        requestAnimationFrame(frame);
    };
    frame()

    /* Unsupervised AI content */
    function syncTimelinePerspective() {
        const belt = document.querySelector("div.timelineBelt");
        if (!belt) return;

        const fov = 30 * Math.PI / 180;
        const perspective = belt.clientHeight / (2 * Math.tan(fov / 2));

        belt.style.setProperty("--timeline-perspective", `${perspective}px`);
    }

    syncTimelinePerspective();
    window.addEventListener("resize", syncTimelinePerspective);

    let projectShowcase = document.querySelector('div.projectShowcase')
    let projectList = document.querySelector(`div.projectList`)
    let iframes = document.querySelector(`div.iframes`)

    let year

    li.forEach((item) => {
        const itemYear = item.getAttribute("data-year");

        // Accessibility: make year cards keyboard/screen-reader friendly
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-label", `Show projects from ${itemYear}`);
        item.setAttribute("aria-pressed", "false");

        item.addEventListener("click", async () => {
            // visual checked state
            item.parentNode
                .querySelectorAll(".checked")
                .forEach((el) => el.classList.remove("checked"));

            item.classList.add("checked");

            // accessibility pressed state
            item.parentNode
                .querySelectorAll('li[data-year][aria-pressed="true"]')
                .forEach((el) => el.setAttribute("aria-pressed", "false"));

            item.setAttribute("aria-pressed", "true");

            year = itemYear;

            projectShowcase.classList.remove("active");

            await getProjects(year);

            // random num
            const now = Date.now();
            const rand = (now % 1000) / 1000;

            document.body.style.setProperty("--rand-global", rand.toFixed(3));
        });

        item.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                item.click();
            }
        });
    });

    /* Unsupervised AI content */
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    let showcaseEventsBound = false;
    let animating = false;
    let openingId = 0;

    const setWrappersPointerEvents = (wrappers, value) => {
        wrappers.forEach((wrapper) => {
            wrapper.style.pointerEvents = value;
        });
    };


    const closeProjectShowcase = async () => {
        const projectShowcase = document.querySelector("div.projectShowcase");
        const iframeWrappers = Array.from(
            document.querySelectorAll(".iframes > .iframe-wrapper")
        );
        const dashboards = document.querySelector(".playzone > .dashboards");

        if (!projectShowcase || !iframeWrappers.length) return;
        if (animating) return;

        clearPinnedDashboardWrapper();

        animating = true;
        openingId++;

        setWrappersPointerEvents(iframeWrappers, "none");

        dashboards?.classList.add("is-closing");
        // await sleep(300);

        for (let i = iframeWrappers.length - 1; i >= 0; i--) {
            const wrapper = iframeWrappers[i];
            wrapper.classList.remove("effect-ready");
            wrapper.querySelector("iframe")?.classList.remove("show");
            await sleep(50);
        }

        await sleep(150);

        for (let i = iframeWrappers.length - 1; i >= 0; i--) {
            const wrapper = iframeWrappers[i];
            wrapper.classList.remove("active");
        }

        projectShowcase?.classList.remove("active");
        dashboards?.classList.remove("is-closing");

        clearPickedIframeWrapper({ deactivate: false, clearChecked: false });

        await sleep(300);

        setWrappersPointerEvents(iframeWrappers, "initial");
        animating = false;
    }

    function showAndLoadIframe(wrapper) {
        if (!wrapper || !wrapper.isConnected) return;

        loadIframe(wrapper);
        wrapper.querySelector("iframe")?.classList.add("show");
    }

    const openProjectShowcase = async () => {
        const projectShowcase = document.querySelector("div.projectShowcase");
        const iframeWrappers = Array.from(
            document.querySelectorAll(".iframes > .iframe-wrapper")
        );

        if (!projectShowcase || !iframeWrappers.length) return;
        if (animating) return;

        clearPinnedDashboardWrapper();

        animating = true;

        const currentOpeningId = ++openingId;

        setWrappersPointerEvents(iframeWrappers, "none");

        projectShowcase.classList.add("active");

        // 第一阶段：只做卡牌展开，不加载 iframe
        for (let i = iframeWrappers.length - 1; i >= 0; i--) {
            if (currentOpeningId !== openingId) {
                animating = false;
                return;
            }

            const wrapper = iframeWrappers[i];

            wrapper.classList.add("active");

            await sleep(50);
        }

        await sleep(450);

        // 第二阶段：先只显示卡片外壳，不立刻加载全部 iframe
        for (let i = iframeWrappers.length - 1; i >= 0; i--) {
            if (currentOpeningId !== openingId) {
                animating = false;
                return;
            }

            const wrapper = iframeWrappers[i];

            wrapper.classList.add("effect-ready");

            await sleep(50);
        }

        // 第三阶段：只先加载第一张，避免 4 个 iframe / PDF 同时抢主线程
        const firstWrapper = iframeWrappers[0];
        showAndLoadIframe(firstWrapper);

        // 其他 iframe 延迟加载
        iframeWrappers.slice(1).forEach((wrapper, index) => {
            window.setTimeout(() => {
                if (currentOpeningId !== openingId) return;
                showAndLoadIframe(wrapper);
            }, 600 + index * 700);
        });

        if (currentOpeningId === openingId) {
            setWrappersPointerEvents(iframeWrappers, "initial");
            animating = false;
        }
    }

    const bindIframeEvents = () => {
        if (showcaseEventsBound) return;
        showcaseEventsBound = true;

        document.addEventListener("click", async (event) => {
            const projectShowcase = document.querySelector("div.projectShowcase");
            const iframes = document.querySelector("div.playzone > div.iframes");
            const title = document.querySelector("div.title > p.title");
            const summary = document.querySelector("div.dashboards > div.summary");

            if (!projectShowcase || !iframes) return;

            const isOpen = projectShowcase.classList.contains("active");

            const clickedActiveWrapper = event.target.closest(".iframe-wrapper.active");
            const clickedTitle = title?.contains(event.target);
            const clickedSummary = summary?.contains(event.target);
            const clickedDashboardControl = event.target.closest(
                ".metric-value, .metric-slot, .metric-label"
            );

            if (
                clickedActiveWrapper ||
                clickedTitle ||
                clickedSummary ||
                clickedDashboardControl
            ) return;

            // 打开：只允许点击 iframe-mask 打开
            if (!isOpen) {
                const pickedWrapper = event.target.closest(".iframe-wrapper.is-picked-wrapper");

                // 1. 如果点击的是已经抽出的 picked wrapper，就打开它
                if (pickedWrapper && iframes.contains(pickedWrapper)) {
                    event.stopPropagation();
                    openPickedIframeWrapper(pickedWrapper);
                    return;
                }

                // 2. 如果当前已经有 picked wrapper，但点击的是外部，
                //    就退回普通牌堆状态
                if (iframes.classList.contains("has-picked-wrapper")) {
                    clearPickedIframeWrapper({
                        deactivate: true,
                        clearChecked: true
                    });
                    return;
                }

                // 3. 没有 picked wrapper 时，保持原来的点击牌堆打开全部逻辑
                const mask = event.target.closest(".iframe-mask");

                if (!mask || !iframes.contains(mask)) return;

                event.stopPropagation();
                await openProjectShowcase();
                return;
            }

            // 关闭：active 状态下，如果只是处于 picked 模式，点击外部只退出 picked，
            // 不关闭整个 projectShowcase
            if (iframes.classList.contains("has-picked-wrapper")) {
                clearPickedIframeWrapper({
                    deactivate: false,
                    clearChecked: true
                });

                clearIframeHoverProjectList();

                await openProjectShowcase();

                return;
            }

            closeProjectShowcase();
        });
    };

    bindIframeEvents();

    document.addEventListener("keydown", async (event) => {
        const projectShowcase = document.querySelector("div.projectShowcase");
        const iframes = document.querySelector("div.playzone > div.iframes");
        const backButton = document.querySelector(".project-back-button.is-visible");

        if (!projectShowcase || !iframes) return;

        const isOpen = projectShowcase.classList.contains("active");

        // Escape: close current state / go back
        if (event.key === "Escape") {
            event.preventDefault();

            // 文件1状态：没有 active，但已经选了某个年份，Back button 可见
            // 这时 Esc 等于点击 Back to all projects
            if (!isOpen && backButton) {
                await goBackToAllProjects();
                return;
            }

            // 没打开，但只是 picked 状态
            if (!isOpen) {
                if (iframes.classList.contains("has-picked-wrapper")) {
                    clearPickedIframeWrapper({
                        deactivate: true,
                        clearChecked: true
                    });

                    clearIframeHoverProjectList();
                }

                return;
            }

            // active + picked：退出 picked
            if (iframes.classList.contains("has-picked-wrapper")) {
                clearPickedIframeWrapper({
                    deactivate: false,
                    clearChecked: true
                });

                clearIframeHoverProjectList();

                await openProjectShowcase();

                return;
            }

            // 普通 active：关闭 showcase
            closeProjectShowcase();
            return;
        }

        // Enter / Space: operate focused iframe-wrapper
        if (event.key !== "Enter" && event.key !== " ") return;

        const wrapper = event.target.closest?.(".iframe-wrapper");

        if (!wrapper) return;

        event.preventDefault();

        if (!isOpen) {
            if (wrapper.classList.contains("is-picked-wrapper")) {
                openPickedIframeWrapper(wrapper);
            } else {
                await openProjectShowcase();
            }

            return;
        }

        loadIframe(wrapper);
        wrapper.querySelector("iframe")?.classList.add("show");
    });

    /* Unsupervised AI content */

    const applyStackVars = (iframes, maxN = 10) => {
        const items = Array.from(iframes.querySelectorAll(".iframe-wrapper"));
        const total = items.length;

        iframes.style.setProperty("--count", total);

        const start = Math.max(0, total - maxN);
        const visible = items.slice(start);
        const visibleCount = visible.length;

        const vh = window.innerHeight / 100;
        const vw = window.innerWidth / 100;

        const u = Math.min(window.innerHeight / 100, window.innerWidth * 0.75 / 100);
        const isFourThreeOrNarrow = window.matchMedia("(max-aspect-ratio: 4/3)").matches;

        const availableWidth = iframes.getBoundingClientRect().width;

        // const targetTotalWidth = 66 * vw - 6 * vh;
        // const cardWidth = 120 * vh;

        const targetTotalWidth = availableWidth - 6 * u;
        const cardWidth = (isFourThreeOrNarrow ? 101 : 120) * u;

        let stepPx = 0;

        if (visibleCount > 1) {
            stepPx = (targetTotalWidth - cardWidth) / (visibleCount - 1);
            stepPx = Math.max(0, stepPx);

            if (stepPx > 0) {
                iframes.style.setProperty("--step-left", `${stepPx}px`);
            } else {
                iframes.style.removeProperty("--step-left");
            }
        } else {
            iframes.style.removeProperty("--step-left");
        }

        visible.forEach((el, i) => {
            el.style.setProperty("--index", i);
        });

        items.slice(0, start).forEach((el) => {
            el.style.removeProperty("--index");
        });
    };

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
        const firstDelay = delay + Math.floor(Math.random() * jitter);
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

    /* Unsupervised AI content */

    function createRippleMapDataURL() {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const width = 512;
        const height = 512;
        const outerRadius = 250;
        const innerRadius = 100;
        const ringWidth = outerRadius - innerRadius;

        canvas.width = width;
        canvas.height = height;

        const cx = width / 2;
        const cy = height / 2;

        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#7f7f7f";
        ctx.fill();

        const colors = [
            "rgb(255,0,0)",
            "rgb(0,255,0)",
            "rgb(255,0,0)",
            "rgb(0,255,0)"
        ];

        const step = Math.PI * 2 / colors.length;
        let angle = 0;

        for (let i = 0; i < colors.length; i++) {
            const nextColor = colors[(i + 1) % colors.length];

            const r = innerRadius + ringWidth / 2;
            const x1 = cx + Math.cos(angle) * r;
            const y1 = cy + Math.sin(angle) * r;
            const x2 = cx + Math.cos(angle + step) * r;
            const y2 = cy + Math.sin(angle + step) * r;

            const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
            gradient.addColorStop(0, colors[i]);
            gradient.addColorStop(1, nextColor);

            ctx.beginPath();
            ctx.strokeStyle = gradient;
            ctx.lineWidth = ringWidth;
            ctx.arc(cx, cy, r, angle, angle + step);
            ctx.stroke();

            angle += step;
        }

        const g = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);

        g.addColorStop(0, "rgba(127,127,127,1)");
        g.addColorStop(17 / ringWidth, "rgba(115,115,115,.8)");
        g.addColorStop(25 / ringWidth, "rgba(115,115,115,0.1)");
        g.addColorStop(28 / ringWidth, "rgba(115,115,115,0.1)");
        g.addColorStop(37 / ringWidth, "rgba(115,104,104,.8)");
        g.addColorStop(43 / ringWidth, "rgba(115,104,104,1)");
        g.addColorStop(44 / ringWidth, "rgba(127,127,127,1)");
        g.addColorStop(50 / ringWidth, "rgba(127,127,127,.6)");
        g.addColorStop(54 / ringWidth, "rgba(127,127,127,0)");
        g.addColorStop(61 / ringWidth, "rgba(0,0,0,0)");
        g.addColorStop(67 / ringWidth, "rgba(0,0,0,1)");
        g.addColorStop(78 / ringWidth, "rgba(0,0,0,1)");
        g.addColorStop(88 / ringWidth, "rgba(0,0,0,0)");
        g.addColorStop(100 / ringWidth, "rgba(0,0,0,0)");
        g.addColorStop(108 / ringWidth, "rgba(0,0,0,1)");
        g.addColorStop(117 / ringWidth, "rgba(0,0,0,1)");
        g.addColorStop(136 / ringWidth, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0)");

        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        return canvas.toDataURL();
    }

    function ensureProjectRippleFilter() {
        if (document.querySelector("#project-ripple-filter")) return;

        const dataURL = createRippleMapDataURL();

        document.body.insertAdjacentHTML(
            "afterbegin",
            `
        <svg style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true">
            <defs>
                <filter id="project-ripple-filter" x="-100%" y="-200%" width="300%" height="500%">
                  <feImage
                    id="project-ripple-image"
                    href="${dataURL}"
                    x="0"
                    y="0"
                    width="0"
                    height="0"
                    result="ripple">
                  </feImage>

                  <!-- 扭曲后的文字 -->
                  <feDisplacementMap
                    id="project-ripple-map"
                    in="SourceGraphic"
                    in2="ripple"
                    scale="0"
                    xChannelSelector="G"
                    yChannelSelector="R"
                    color-interpolation-filters="sRGB"
                    result="displaced">
                  </feDisplacementMap>

                  <!-- 只保留 ripple 覆盖区域内的扭曲文字 -->
                  <feComposite
                    in="displaced"
                    in2="ripple"
                    operator="in"
                    result="displacedInsideRipple">
                  </feComposite>

                  <!-- 从原文字里挖掉 ripple 覆盖区域，避免重影 -->
                  <feComposite
                    in="SourceGraphic"
                    in2="ripple"
                    operator="out"
                    result="sourceOutsideRipple">
                  </feComposite>

                  <!-- 原文字非 ripple 区域 + ripple 区域扭曲文字 -->
                  <feComposite
                    in="displacedInsideRipple"
                    in2="sourceOutsideRipple"
                    operator="over">
                  </feComposite>
                </filter>
            </defs>
        </svg>
        `
        );
    }

    const PROJECT_RIPPLE_DURATION = 3050;
    const PROJECT_RIPPLE_SKIP_TIME = 50;

    // 颜色圈比白色涟漪边缘稍微慢一点/小一点
    function getYearCssVar(year, varName, fallback = "") {
        const source = document.querySelector(`ul.timeList > li[data-year="${year}"]`);

        if (!source) return fallback;

        const value = getComputedStyle(source).getPropertyValue(varName).trim();

        return value || fallback;
    }
    let yearColorRippleRaf = 0;
    let yearColorRippleToken = 0;

    function triggerYearColorRipple(targetYear, event, onDone) {
        const iframes = document.querySelector(".iframes");
        if (!iframes || !targetYear) return;

        yearColorRippleToken++;
        const token = yearColorRippleToken;

        if (yearColorRippleRaf) {
            cancelAnimationFrame(yearColorRippleRaf);
            yearColorRippleRaf = 0;
        }

        const yearRgb = getYearCssVar(targetYear, "--year-rgb", "255 255 255");

        const rect = iframes.getBoundingClientRect();

        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        const distances = [
            Math.hypot(clickX, clickY),
            Math.hypot(rect.width - clickX, clickY),
            Math.hypot(clickX, rect.height - clickY),
            Math.hypot(rect.width - clickX, rect.height - clickY),
        ];

        const maxDistance = Math.max(...distances);
        const finalRadius = maxDistance * 1.1;

        iframes.classList.add("year-color-rippling");
        iframes.style.setProperty("--year-ripple-x", `${clickX}px`);
        iframes.style.setProperty("--year-ripple-y", `${clickY}px`);
        iframes.style.setProperty("--year-ripple-rgb", yearRgb);
        iframes.style.setProperty("--year-ripple-alpha", "0.2");
        iframes.style.setProperty("--year-ripple-radius", "0px");

        const start = performance.now();
        const duration = PROJECT_RIPPLE_DURATION;

        let dataDateApplied = false;
        const DATA_DATE_APPLY_TIME = 1550;

        function animate(now) {
            if (token !== yearColorRippleToken) return;

            const t = Math.min(1, Math.max(0, (now - start) / duration));
            const elapsed = now - start;

            if (!dataDateApplied && elapsed >= DATA_DATE_APPLY_TIME) {
                iframes.setAttribute("data-year", String(targetYear));
                dataDateApplied = true;
            }

            const skipProgress = Math.min(
                0.35,
                PROJECT_RIPPLE_SKIP_TIME / duration
            );

            const visualT = skipProgress + (1 - skipProgress) * t;

            // 跟你的主涟漪保持类似节奏
            const radius = finalRadius * visualT;

            // 颜色随扩散逐渐透明
            const startAlpha = 0.1;
            const alpha = startAlpha * (1 - t);

            iframes.style.setProperty("--year-ripple-radius", `${radius}px`);
            iframes.style.setProperty("--year-ripple-alpha", alpha.toFixed(3));

            if (t < 1) {
                yearColorRippleRaf = requestAnimationFrame(animate);
            } else {
                if (!dataDateApplied) {
                    iframes.setAttribute("data-year", String(targetYear));
                    dataDateApplied = true;
                }

                iframes.setAttribute("data-year", String(targetYear));

                iframes.classList.remove("year-color-rippling");

                iframes.style.removeProperty("--year-ripple-x");
                iframes.style.removeProperty("--year-ripple-y");
                iframes.style.removeProperty("--year-ripple-rgb");
                iframes.style.removeProperty("--year-ripple-alpha");
                iframes.style.removeProperty("--year-ripple-radius");

                if (typeof onDone === "function") {
                    onDone();
                }

                yearColorRippleRaf = 0;
            }
        }

        yearColorRippleRaf = requestAnimationFrame(animate);
    }

    let projectRippleRaf = 0;
    let projectRippleToken = 0;
    let currentRippleTarget = null;

    function triggerProjectListRipple(target, event) {
        if (!target) return;

        ensureProjectRippleFilter();

        const feImage = document.querySelector("#project-ripple-image");
        const displacement = document.querySelector("#project-ripple-map");

        if (!feImage || !displacement) return;

        if (currentRippleTarget && currentRippleTarget !== target) {
            currentRippleTarget.classList.remove("is-rippling");
        }

        currentRippleTarget = target;

        projectRippleToken++;
        const token = projectRippleToken;

        if (projectRippleRaf) {
            cancelAnimationFrame(projectRippleRaf);
            projectRippleRaf = 0;
        }

        target.classList.add("is-rippling");

        const rect = target.getBoundingClientRect();

        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        const distances = [
            Math.hypot(clickX, clickY),
            Math.hypot(rect.width - clickX, clickY),
            Math.hypot(clickX, rect.height - clickY),
            Math.hypot(rect.width - clickX, rect.height - clickY),
        ];

        const maxDistance = Math.max(...distances);
        const finalSize = maxDistance * 2.4;

        const startScale = 2 * finalSize / 512;

        const start = performance.now();
        const duration = PROJECT_RIPPLE_DURATION;

        function animate(now) {
            if (token !== projectRippleToken) return;

            const t = Math.min(1, Math.max(0, (now - start) / duration));

            // const size = finalSize * t;
            const skipTime = PROJECT_RIPPLE_SKIP_TIME;
            const skipProgress = Math.min(0.35, skipTime / duration);

            const visualT = skipProgress + (1 - skipProgress) * t;
            const size = finalSize * visualT;
            const scale = startScale * (1 - t);

            feImage.setAttribute("x", clickX - size / 2);
            feImage.setAttribute("y", clickY - size / 2);
            feImage.setAttribute("width", Math.max(1, size));
            feImage.setAttribute("height", Math.max(1, size));

            displacement.setAttribute("scale", scale.toFixed(2));

            if (t < 1) {
                projectRippleRaf = requestAnimationFrame(animate);
            } else {
                displacement.setAttribute("scale", "0");
                feImage.setAttribute("width", "0");
                feImage.setAttribute("height", "0");

                if (currentRippleTarget === target) {
                    target.classList.remove("is-rippling");
                    currentRippleTarget = null;
                }

                projectRippleRaf = 0;
            }
        }

        projectRippleRaf = requestAnimationFrame(animate);
    }

    function renderSingleProjectInIframes(project, index = null) {
        const iframes = document.querySelector(".iframes");

        if (!iframes || !project) return;

        clearPinnedDashboardWrapper();

        const { name, URLs } = project;

        const safeName = escapeAttr(name);
        const safeKey = escapeAttr(getProjectDashboardKey(project, index));

        const firstURL = URLs?.[0] || "about:blank";
        const isMobile = name.trim().endsWith("(mobile)");
        const iframeClass = isMobile ? "projectShowcase mobile" : "projectShowcase";
        const safeUrls = encodeURIComponent(JSON.stringify(URLs || []));

        _clearAllRotators();

        iframes.innerHTML = "";

        iframes.insertAdjacentHTML("beforeend", `
            <div 
                class="iframe-wrapper" 
                data-index="${index ?? ""}"        
                role="button"
                tabindex="0"
                aria-label="Open preview for ${safeName}"
                data-dashboard-key="${safeKey}">
                <iframe
                    class="${iframeClass}"
                    title="${safeName} preview"
                    data-src="${firstURL}"
                    data-urls="${safeUrls}"
                    src="about:blank"
                    frameborder="0"
                    tabindex="-1">
                </iframe>
                <div class="iframe-mask"></div>
            </div>
        `);

        const wrapper = iframes.lastElementChild;
        const iframeEl = wrapper.querySelector("iframe");

        _attachRotator(iframeEl, URLs, 4000);
        applyStackVars(iframes, 1);
    }

    let currentRenderYear = "all";
    function getProjectYear(project) {
        return String(project?.year || currentRenderYear || "all");
    }

    function setCheckedTimelineYear(year) {
        document
            .querySelectorAll('ul.timeList > li[data-year].checked')
            .forEach((el) => el.classList.remove("checked"));

        document
            .querySelector(`ul.timeList > li[data-year="${year}"]`)
            ?.classList.add("checked");
    }

    let timelineCenterRaf = 0;
    let timelineCenterTargetYear = null;

    const TIMELINE_TARGET_TOP = 232;
    const TIMELINE_CENTER_TOLERANCE = 2;

    const TIMELINE_WHEEL_DIRECTION = -1;

    function isTimelineYearFront(year) {
        const item = document.querySelector(`ul.timeList > li[data-year="${year}"]`);
        if (!item) return false;

        return getComputedStyle(item).visibility !== "hidden";
    }

    function requestCenterTimelineYear(year) {
        if (!year || year === "all") return;

        const yearStr = String(year);

        // 如果这个年份已经在正面，就不滚动
        if (isTimelineYearFront(yearStr)) {
            stopCenterTimelineYear();
            return;
        }

        if (timelineCenterTargetYear !== yearStr) {
            clearTimelineScrollQueue();
        }

        timelineCenterTargetYear = yearStr;

        if (!timelineCenterRaf) {
            timelineCenterRaf = requestAnimationFrame(centerTimelineYearStep);
        }
    }

    function stopCenterTimelineYear() {
        timelineCenterTargetYear = null;

        if (timelineCenterRaf) {
            cancelAnimationFrame(timelineCenterRaf);
            timelineCenterRaf = 0;
        }

        clearTimelineScrollQueue();
    }

    function centerTimelineYearStep() {
        timelineCenterRaf = 0;

        const year = timelineCenterTargetYear;
        if (!year) return;

        const item = document.querySelector(`ul.timeList > li[data-year="${year}"]`);
        const belt = document.querySelector("div.timelineBelt");

        if (!item || !belt) {
            stopCenterTimelineYear();
            return;
        }

        // 关键：每一帧都重新检查是否已经显示出来
        // 一旦年份已经到正面，就停止继续 queueTimelineScroll
        if (isTimelineYearFront(year)) {
            stopCenterTimelineYear();
            return;
        }

        const itemRect = item.getBoundingClientRect();
        const beltRect = belt.getBoundingClientRect();

        // 因为现在位置在 transform 里，所以不能再用 item.style.top
        const currentCenterY =
            itemRect.top - beltRect.top + itemRect.height / 2;

        if (!Number.isFinite(currentCenterY)) {
            timelineCenterRaf = requestAnimationFrame(centerTimelineYearStep);
            return;
        }

        const diff = currentCenterY - TIMELINE_TARGET_TOP;

        if (Math.abs(diff) <= TIMELINE_CENTER_TOLERANCE) {
            stopCenterTimelineYear();
            return;
        }

        const deltaY =
            TIMELINE_WHEEL_DIRECTION *
            Math.max(-60, Math.min(60, diff * 0.75));

        queueTimelineScroll(deltaY);

        timelineCenterRaf = requestAnimationFrame(centerTimelineYearStep);
    }

    let projectListClickBound = false;
    let projectListHoverBound = false;
    let lastHoverTimelineYear = null;
    let currentProjects = [];

    const DEFAULT_DASHBOARD_META = Object.freeze({
        description: "",
        complexity: 0,
        ownership: 0,
        impact: 0,
    });

    let dashboardUpdateToken = 0;

    function getProjectDashboardKey(project, index) {
        if (!project) return "";

        if (project.id) {
            return String(project.id);
        }

        const year = String(project.year || currentRenderYear || "all");
        const name = String(project.name || `project-${index}`);

        return `${year}::${name}`;
    }

    function normalizeDashboardMeta(meta = {}) {
        return {
            description: String(meta.description || ""),
            complexity: clamp(Number(meta.complexity) || 0, 0, 100),
            ownership: clamp(Number(meta.ownership) || 0, 0, 100),
            impact: clamp(Number(meta.impact) || 0, 0, 100),
        };
    }

    async function getProjectDashboardMeta(project, index) {
        return normalizeDashboardMeta(
            project?.dashboard || DEFAULT_DASHBOARD_META
        );
    }

    function getProjectPrimaryURL(project, wrapper = null) {
        const currentIframeSrc = wrapper
            ?.querySelector("iframe")
            ?.getAttribute("src");

        if (currentIframeSrc && currentIframeSrc !== "about:blank") {
            return currentIframeSrc;
        }

        return project?.URLs?.[0] || "";
    }

    function setMetricValue(metricName, value) {
        const metric = document.querySelector(`.metric-${metricName}`);
        if (!metric) return;

        const percent = clamp(Number(value) || 0, 0, 100);

        metric.style.setProperty("--value", `${percent}%`);

        const valueEl = metric.querySelector(".metric-value");

        if (valueEl) {
            valueEl.textContent = `${Math.round(percent)}%`;
        }
    }

    function renderDashboardProject(project, index, meta, wrapper = null) {
        const summary = document.querySelector(".dashboards > .summary");
        if (!summary) return;

        const titleLink = summary.querySelector(".summary-title-link");
        const descriptionEl = summary.querySelector(".summary-description");

        const year = project ? getProjectYear(project) : "";
        const name = project?.name || "";
        const href = getProjectPrimaryURL(project, wrapper);

        if (titleLink) {
            titleLink.textContent = name ? `${year} · ${name}` : "";

            if (href) {
                titleLink.href = href;
                titleLink.removeAttribute("aria-disabled");
                titleLink.tabIndex = 0;
            } else {
                titleLink.href = "#";
                titleLink.setAttribute("aria-disabled", "true");
                titleLink.tabIndex = -1;
            }
        }

        if (descriptionEl) {
            descriptionEl.textContent = meta.description || "";
        }

        setMetricValue("complexity", meta.complexity);
        setMetricValue("ownership", meta.ownership);
        setMetricValue("impact", meta.impact);
    }

    async function updateDashboardByIndex(index, wrapper = null) {
        const projectIndex = Number(index);

        if (!Number.isInteger(projectIndex)) return;

        const project = currentProjects[projectIndex];

        if (!project) {
            renderDashboardProject(null, -1, DEFAULT_DASHBOARD_META);
            return;
        }

        const token = ++dashboardUpdateToken;
        const meta = await getProjectDashboardMeta(project, projectIndex);

        if (token !== dashboardUpdateToken) return;

        renderDashboardProject(project, projectIndex, meta, wrapper);
    }

    function updateDashboardFromWrapper(wrapper) {
        if (!wrapper) return;

        updateDashboardByIndex(wrapper.dataset.index, wrapper);
    }

    function updateDashboardFromFirstWrapper() {
        const wrapper = document.querySelector(
            ".iframes > .iframe-wrapper[data-index]"
        );

        if (!wrapper) {
            renderDashboardProject(null, -1, DEFAULT_DASHBOARD_META);
            return;
        }

        updateDashboardFromWrapper(wrapper);
    }

    let iframeWrapperHoverBound = false;
    let pinnedDashboardWrapper = null;

    function clearIframeHoverProjectList() {
        document
            .querySelectorAll(".hotzone-list > li.is-iframe-hover")
            .forEach((el) => el.classList.remove("is-iframe-hover"));
    }

    function shouldHoverAllProjectListItems() {
        const iframes = document.querySelector(".iframes");
        if (!iframes) return false;

        const wrappers = iframes.querySelectorAll(".iframe-wrapper[data-index]");
        const activeWrapper = iframes.querySelector(".iframe-wrapper.active");

        return wrappers.length > 1 && !activeWrapper;
    }

    function setIframeHoverProjectList(index) {
        clearIframeHoverProjectList();

        if (shouldHoverAllProjectListItems()) {
            document
                .querySelectorAll(".hotzone-list > li[data-index]")
                .forEach((el) => el.classList.add("is-iframe-hover"));

            return;
        }

        if (index === undefined || index === null || index === "") return;

        document
            .querySelector(`.hotzone-list > li[data-index="${index}"]`)
            ?.classList.add("is-iframe-hover");
    }

    function clearProjectListChecked() {
        document
            .querySelectorAll(".hotzone-list > li.checked")
            .forEach((el) => el.classList.remove("checked"));
    }

    function clearPickedIframeWrapper(options = {}) {
        const { deactivate = false, clearChecked = true } = options;

        const iframes = document.querySelector(".iframes");
        if (!iframes) return;

        iframes.classList.remove("has-picked-wrapper");

        iframes
            .querySelectorAll(".iframe-wrapper.is-picked-wrapper")
            .forEach((wrapper) => {
                wrapper.classList.remove("is-picked-wrapper");

                if (deactivate) {
                    wrapper.classList.remove("active");
                    wrapper.classList.remove("effect-ready");
                    wrapper.querySelector("iframe")?.classList.remove("show");
                }
            });

        if (clearChecked) {
            clearProjectListChecked();
        }
    }

    function pickExistingIframeWrapper(index) {
        const projectShowcase = document.querySelector("div.projectShowcase");
        const iframes = document.querySelector(".iframes");

        if (!projectShowcase || !iframes) return false;

        const wrappers = iframes.querySelectorAll(".iframe-wrapper[data-index]");

        // 只有多张牌时才走 pick 逻辑
        if (wrappers.length <= 1) return false;

        const wrapper = iframes.querySelector(
            `.iframe-wrapper[data-index="${index}"]`
        );

        if (!wrapper) return false;

        clearPinnedDashboardWrapper();

        const wasOpen = projectShowcase.classList.contains("active");

        // 如果本来是 active 展开状态，不要 deactivate 旧 wrapper
        // 如果本来不是 active，只是在牌堆状态，则清掉旧 picked 的 active/show
        clearPickedIframeWrapper({
            deactivate: !wasOpen,
            clearChecked: false
        });

        iframes.classList.add("has-picked-wrapper");
        wrapper.classList.add("is-picked-wrapper");

        if (wasOpen) {
            projectShowcase.classList.add("active");

            loadIframe(wrapper);

            // 关键：放大/移动前先关掉 blur，避免 backdrop-filter 参与动画
            wrapper.classList.remove("effect-ready");

            wrapper.classList.add("active");
            wrapper.classList.add("is-picked-wrapper");
            wrapper.querySelector("iframe")?.classList.add("show");

            window.setTimeout(() => {
                if (wrapper.classList.contains("is-picked-wrapper")) {
                    wrapper.classList.add("effect-ready");
                }
            }, 300);
        } else {
            // 当前不是打开状态：只 pick，不 active
            projectShowcase.classList.remove("active");

            wrapper.classList.remove("active");
            wrapper.classList.remove("effect-ready");
            wrapper.querySelector("iframe")?.classList.remove("show");
        }

        return true;
    }

    function openPickedIframeWrapper(wrapper) {
        const projectShowcase = document.querySelector("div.projectShowcase");
        const iframes = document.querySelector(".iframes");

        if (!projectShowcase || !iframes || !wrapper) return false;
        if (!wrapper.classList.contains("is-picked-wrapper")) return false;

        clearPinnedDashboardWrapper();

        projectShowcase.classList.add("active");
        iframes.classList.add("has-picked-wrapper");

        loadIframe(wrapper);

        wrapper.classList.add("active");
        wrapper.classList.add("effect-ready");
        wrapper.querySelector("iframe")?.classList.add("show");

        return true;
    }

    function escapeAttr(value = "") {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll('"', "&quot;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
    }

    function renderProjectListItems(projects, year) {
        return projects
            .map((project, index) => {
                const safeName = escapeAttr(project.name);
                const safeKey = escapeAttr(getProjectDashboardKey(project, index));

                return `
                    <li
                        role="button"
                        tabindex="0"
                        aria-label="Open project: ${safeName}"
                        data-index="${index}"
                        data-year="${year}"
                        data-dashboard-key="${safeKey}">
                        <span class="project-label" data-text="${safeName}">${safeName}</span>
                    </li>
                        `;
            })
            .join("");
    }

    function renderIframeCards(projects) {
        return projects
            .map((project, index) => {
                const { name, URLs } = project;

                const safeName = escapeAttr(name);
                const firstURL = URLs?.[0] || "about:blank";
                const isMobile = name.trim().endsWith("(mobile)");
                const iframeClass = isMobile ? "projectShowcase mobile" : "projectShowcase";
                const safeUrls = encodeURIComponent(JSON.stringify(URLs || []));
                const safeKey = escapeAttr(getProjectDashboardKey(project, index));

                return `
                <div
                    class="iframe-wrapper"
                    role="button"
                    tabindex="0"
                    aria-label="Open preview for ${safeName}"
                    data-index="${index}"
                    data-dashboard-key="${safeKey}">
                    <iframe
                        class="${iframeClass}"
                        title="${safeName} preview"
                        data-src="${firstURL}"
                        data-urls="${safeUrls}"
                        src="about:blank"
                        frameborder="0"
                        tabindex="-1">
                    </iframe>
                    <div class="iframe-mask"></div>
                </div>
            `;
            })
            .join("");
    }

    function clearIframeWrapperHoverState() {
        document
            .querySelectorAll(".iframes > .iframe-wrapper.is-dashboard-hover")
            .forEach((wrapper) => {
                wrapper.classList.remove("is-dashboard-hover");
            });
    }

    function setDashboardHoverWrapper(wrapper) {
        if (!wrapper) return;

        // 固定后，普通鼠标 hover 不允许切换当前 dashboard wrapper
        if (pinnedDashboardWrapper && pinnedDashboardWrapper !== wrapper) return;

        clearIframeWrapperHoverState();

        wrapper.classList.add("is-dashboard-hover");

        setIframeHoverProjectList(wrapper.dataset.index);
        updateDashboardFromWrapper(wrapper);
    }

    function resetDashboardHoverState() {
        if (pinnedDashboardWrapper) return;

        clearIframeWrapperHoverState();
        clearIframeHoverProjectList();
        updateDashboardFromFirstWrapper();
    }

    function setTapePinned(isPinned) {
        const tape = document.querySelector(".tape");
        const showcase = document.querySelector("div.projectShowcase");

        if (!tape) return;

        tape.src = isPinned ? "/resources/tape_2.png" : "/resources/tape.png";
        tape.classList.toggle("is-pinned", isPinned);
        showcase?.classList.toggle("is-dashboard-pinned", isPinned);
    }

    function clearPinnedDashboardWrapper() {
        pinnedDashboardWrapper?.classList.remove("is-dashboard-pinned");
        pinnedDashboardWrapper = null;
        setTapePinned(false);
    }

    function bindIframeWrapperHoverToProjectList() {
        if (iframeWrapperHoverBound) return;
        iframeWrapperHoverBound = true;

        const showcase = document.querySelector("div.projectShowcase");
        const iframes = document.querySelector(".iframes");
        const tape = document.querySelector(".tape");

        if (!showcase || !iframes) return;

        showcase.addEventListener("pointerover", (event) => {
            if (pinnedDashboardWrapper) return;

            const wrapper = event.target.closest(".iframe-wrapper[data-index]");

            if (!wrapper || !iframes.contains(wrapper)) return;
            if (event.relatedTarget && wrapper.contains(event.relatedTarget)) return;

            setDashboardHoverWrapper(wrapper);
        });

        tape?.addEventListener("pointerdown", (event) => {
            event.stopPropagation();
        });

        tape?.addEventListener("click", (event) => {
            event.stopPropagation();

            const currentWrapper =
                pinnedDashboardWrapper ||
                document.querySelector(".iframes > .iframe-wrapper.is-dashboard-hover");

            if (!currentWrapper) return;

            if (pinnedDashboardWrapper === currentWrapper) {
                currentWrapper.classList.remove("is-dashboard-pinned");
                pinnedDashboardWrapper = null;
                setTapePinned(false);
                return;
            }

            clearPinnedDashboardWrapper();

            pinnedDashboardWrapper = currentWrapper;
            pinnedDashboardWrapper.classList.add("is-dashboard-pinned");

            setDashboardHoverWrapper(pinnedDashboardWrapper);
            setTapePinned(true);
        });

        iframes.addEventListener("pointerleave", (event) => {
            if (pinnedDashboardWrapper) return;

            const next = event.relatedTarget;

            // 鼠标移到 tape 上，不取消当前 iframe-wrapper hover
            if (next?.closest?.(".tape")) return;

            // 鼠标移到 dashboard 上，也可以不取消，方便点 summary title
            if (next?.closest?.(".dashboards")) return;

            resetDashboardHoverState();
        });
    }

    function loadIframe(wrapper) {
        const iframe = wrapper?.querySelector("iframe");
        if (!iframe) return;

        const src = iframe.dataset.src;
        if (!src) return;

        if (iframe.getAttribute("src") !== "about:blank") return;

        iframe.src = src;

        const urls = JSON.parse(decodeURIComponent(iframe.dataset.urls || "[]"));
        _attachRotator(iframe, urls, 4000);
    }

    function triggerDealInAnimation(iframes) {
        if (!iframes) return;

        const wrappers = Array.from(
            iframes.querySelectorAll(".iframe-wrapper")
        );

        if (!wrappers.length) return;

        iframes.classList.remove("is-dealing");

        wrappers.forEach((wrapper, index) => {
            const randomX = (Math.random() - 0.5) * 260;
            const startRot = -45 + Math.random() * 90;
            const delay = index * 38 + Math.random() * 45;

            wrapper.style.setProperty("--deal-x", `${randomX.toFixed(1)}px`);
            wrapper.style.setProperty("--deal-start-rot", `${startRot.toFixed(1)}deg`);
            wrapper.style.setProperty("--deal-delay", `${delay.toFixed(0)}ms`);
        });

        // 强制重启动画
        void iframes.offsetWidth;

        let finishedCount = 0;

        wrappers.forEach((wrapper) => {
            wrapper.addEventListener(
                "animationend",
                () => {
                    finishedCount++;

                    if (finishedCount >= wrappers.length) {
                        iframes.classList.remove("is-dealing");
                    }
                },
                { once: true }
            );
        });

        iframes.classList.add("is-dealing");
    }

    const renderProjects = (year, projects) => {
        const hotzoneList = document.querySelector('.hotzone-list');
        const iframes = document.querySelector('.iframes');
        const backButton = document.querySelector(".project-back-button");

        backButton?.classList.toggle("is-visible", year !== `all`);

        _clearAllRotators();
        clearPinnedDashboardWrapper();

        currentProjects = projects;
        currentRenderYear = year;
        // console.log(`year:`, year)

        if (year != `all`) {
            hotzoneList.innerHTML = renderProjectListItems(projects, year);
            iframes.innerHTML = renderIframeCards(projects);

            iframes.setAttribute("data-year", year);
            applyStackVars(iframes, projects.length);

            triggerDealInAnimation(iframes);
            updateDashboardFromFirstWrapper();
        } else {
            hotzoneList.innerHTML = projects
                .map((project, index) => {
                    const { name, year } = project;
                    const safeName = escapeAttr(name);
                    const safeKey = escapeAttr(getProjectDashboardKey(project, index));

                    return `
                    <li
                        role="button"
                        tabindex="0"
                        aria-label="Open project: ${safeName}"
                        data-index="${index}"
                        data-year="${year}"
                        data-dashboard-key="${safeKey}">
                        <span class="project-label" data-text="${safeName}">${safeName}</span>
                    </li>
                        `;
                })
                .join("");

            resetIframesToDefault();
            updateDashboardFromFirstWrapper();
        }

        if (!projectListClickBound) {
            projectListClickBound = true;

            hotzoneList.addEventListener("keydown", (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;

                const li = event.target.closest("li[role='button']");
                if (!li || !hotzoneList.contains(li)) return;

                event.preventDefault();
                li.click();
            });

            hotzoneList.addEventListener("click", (event) => {
                const li = event.target.closest("li");

                // 点到 hotzone-list 空白区域：不要阻止冒泡
                // 让 document click 逻辑继续执行，从而可以关闭 active iframe-wrapper
                if (!li || !hotzoneList.contains(li)) return;

                // 只有真的点到 li，才阻止冒泡
                // 这样点击项目不会触发关闭
                event.stopPropagation();

                const index = Number(li.dataset.index);
                const project = currentProjects[index];

                if (!project) return;

                const targetYear = getProjectYear(project);

                hotzoneList
                    .querySelectorAll("li.checked")
                    .forEach((el) => el.classList.remove("checked"));

                li.classList.add("checked");

                const pickedExistingWrapper = pickExistingIframeWrapper(index);

                if (!pickedExistingWrapper) {
                    renderSingleProjectInIframes(project, index);
                }

                setCheckedTimelineYear(targetYear);

                // const showcaseArea = document.querySelector("div.projectShowcase");
                // triggerProjectListRipple(showcaseArea, event);

                // triggerYearColorRipple(targetYear, event);
                const iframeCount = document.querySelectorAll(
                    ".iframes > .iframe-wrapper"
                ).length;

                const shouldPlayRipple = iframeCount <= 1;

                if (shouldPlayRipple) {
                    const showcaseArea = document.querySelector("div.projectShowcase");
                    triggerProjectListRipple(showcaseArea, event);

                    triggerYearColorRipple(targetYear, event);
                }
            });
        }

        if (!projectListHoverBound) {
            projectListHoverBound = true;

            hotzoneList.addEventListener("pointerover", (event) => {
                if (pinnedDashboardWrapper) return;

                const projectLi = event.target.closest("li[data-year]");
                if (!projectLi || !hotzoneList.contains(projectLi)) return;

                if (event.relatedTarget && projectLi.contains(event.relatedTarget)) return;

                const year = projectLi.dataset.year;

                updateDashboardByIndex(Number(projectLi.dataset.index));

                if (year === lastHoverTimelineYear) return;
                lastHoverTimelineYear = year;

                requestCenterTimelineYear(year);
            });

            hotzoneList.addEventListener("pointerleave", () => {
                lastHoverTimelineYear = null;
                stopCenterTimelineYear();
            });
        }

        bindIframeEvents();
        bindIframeWrapperHoverToProjectList();
    };

    //const ws = new WebSocket(`wss://localhost:443`)
    const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
    // const wsUrl = `${wsProtocol}//${location.host}/ws`;
    const wsUrl =
        location.hostname === "127.0.0.1" || location.hostname === "localhost"
            ? "ws://127.0.0.1:3000/ws"
            : `${wsProtocol}//${location.host}/ws`;

    let ws = null;
    let reconnectTimer = null;
    let reconnectDelay = 1000;
    let lastRequestedYear = null;

    function connectWebSocket() {
        if (
            ws &&
            (ws.readyState === WebSocket.OPEN ||
                ws.readyState === WebSocket.CONNECTING)
        ) {
            return;
        }

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("✅ WebSocket connected");

            reconnectDelay = 1000;

            // 重新连接后，恢复当前页面数据
            getProjects(lastRequestedYear);
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            if (msg.type === "projects") {
                renderProjects(msg.year, msg.data.reverse());
            }
        };

        ws.onerror = (error) => {
            console.warn("⚠️ WebSocket error:", error);
            ws.close();
        };

        ws.onclose = () => {
            console.warn("❌ WebSocket closed, reconnecting...");

            clearTimeout(reconnectTimer);

            reconnectTimer = setTimeout(() => {
                connectWebSocket();
            }, reconnectDelay);

            reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
        };
    }

    function sendWS(message) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket not ready, reconnecting...");

            connectWebSocket();

            // 等连接恢复后再补发一次
            setTimeout(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(message));
                }
            }, 500);

            return;
        }

        ws.send(JSON.stringify(message));
    }

    const getProjects = (year) => {
        lastRequestedYear = year || null;

        sendWS({
            type: "projects",
            ...(year ? { year } : {})
        });
    };

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            if (!ws || ws.readyState === WebSocket.CLOSED) {
                connectWebSocket();
            } else if (ws.readyState === WebSocket.OPEN) {
                getProjects(lastRequestedYear);
            }
        }
    });

    window.addEventListener("online", () => {
        connectWebSocket();
    });

    connectWebSocket();


    /* Unsupervised AI content */

    // Bubble
    (() => {
        const TTL_BASE = 4200;         // 基础 TTL
        const TTL_JITTER = 2000;         // 0~2000ms 随机
        const MAX = 7;            // 同屏最多

        const email = "hrjlhy@gmail.com";
        const phone = "+1 (206) 551-4288";

        const MESSAGES = [
            { type: 'text', text: "My name is Jack Hao." },
            { type: 'email', text: email },
            { type: 'phone', text: phone }
        ];

        const bubbles = new Set();
        const states = new Map(); // el -> {x,y,r, t0, ax1.., up, timerId, dieAt, remaining, hover, mx,my}

        let messageIndex = 0;

        function getNextMessage() {
            const msg = MESSAGES[messageIndex % MESSAGES.length];
            messageIndex++;

            return msg;
        }

        function spawnRandomBubbleInProjectListRightHalf() {
            if (!projectList) return;

            const rect = projectList.getBoundingClientRect();

            const padding = 36;

            const minX = rect.left + rect.width * 0.5 + padding;
            const maxX = rect.right - padding;
            const minY = rect.top + padding;
            const maxY = rect.bottom - padding;

            if (maxX <= minX || maxY <= minY) return;

            const x = rnd(minX, maxX);
            const y = rnd(minY, maxY);

            spawnHole(x, y);
        }

        document.addEventListener("title-firework-bubble", () => {
            spawnRandomBubbleInProjectListRightHalf();
        });

        function spawnHole(x, y) {
            if (bubbles.size >= MAX) {
                const oldest = bubbles.values().next().value;
                removeHole(oldest);
            }

            const r = 56 + (84 - 56) * Math.pow(Math.random(), 0.35); // 偏大分布

            const msg = getNextMessage();

            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.style.setProperty('--x', x + 'px');
            bubble.style.setProperty('--y', y + 'px');
            bubble.style.setProperty('--r', r + 'px');

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

    // return button

    function resetIframesToDefault() {
        const iframes = document.querySelector(".iframes");
        if (!iframes) return;

        _clearAllRotators();

        iframes.removeAttribute("data-year");
        iframes.style.removeProperty("--count");
        iframes.style.removeProperty("--step-left");
        iframes.classList.remove("has-picked-wrapper");

        const defaultName = "Default portfolio preview";
        const defaultIndex = "36";
        const defaultKey = "default::portfolio";

        iframes.innerHTML = `
        <div 
            class="iframe-wrapper" 
            data-index="${defaultIndex}"         
            role="button"
            tabindex="0"
            aria-label="Open preview for ${defaultName}"
            data-dashboard-key="${defaultKey}">
            <iframe 
                class="projectShowcase"
                title="${defaultName} preview"
                src="https://www.hrjlhy.com/index_old_2025-08-09.html"
                frameborder="0"
                tabindex="-1">
            </iframe>
            <div class="iframe-mask"></div>
        </div>
    `;

        applyStackVars(iframes, 1);
        clearPinnedDashboardWrapper();
    }

    async function goBackToAllProjects(event = null) {
        event?.stopPropagation?.();

        const showcaseArea = document.querySelector("div.projectShowcase");

        // 鼠标点击时保留 ripple；键盘 Escape 没有 clientX/clientY，所以跳过 ripple
        if (
            event &&
            Number.isFinite(event.clientX) &&
            Number.isFinite(event.clientY)
        ) {
            triggerProjectListRipple(showcaseArea, event);
        }

        document
            .querySelectorAll("ul.timeList > li[data-year].checked")
            .forEach((el) => el.classList.remove("checked"));

        document
            .querySelectorAll('ul.timeList > li[data-year][aria-pressed="true"]')
            .forEach((el) => el.setAttribute("aria-pressed", "false"));

        document.querySelector("div.projectShowcase")?.classList.remove("active");

        resetIframesToDefault();

        await getProjects();
    }

    document
        .querySelector(".project-back-button")
        ?.addEventListener("click", goBackToAllProjects);

    /* Unsupervised AI content */

    function initProjectCellBlob() {
        const host = document.querySelector(".projectList");
        const list = host?.querySelector(".hotzone-list");
        const backButton = host.querySelector(".project-back-button");

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

        function setTargetFromElement(el, shape = "pill") {
            const targetElement =
                el.querySelector(".project-label") ||
                el.querySelector(".project-back-icon") ||
                el;

            const rect = targetElement.getBoundingClientRect();
            const hostRect = host.getBoundingClientRect();

            if (shape === "circle") {
                const size = Math.max(rect.width, rect.height) + 22;

                target.x = rect.left - hostRect.left + rect.width / 2 - size / 2;
                target.y = rect.top - hostRect.top + rect.height / 2 - size / 2;
                target.w = size;
                target.h = size;
            } else {
                const paddingX = 8;
                const paddingY = 8;

                target.x = rect.left - hostRect.left - paddingX / 2 - 38;
                target.y = rect.top - hostRect.top - paddingY;
                target.w = rect.width - paddingX * 2 + 38 * 2;
                target.h = rect.height + paddingY * 2;
            }

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

            setTargetFromElement(li, "pill");
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

                setTargetFromElement(activeLi, "pill");
                start();
            },
            { passive: true }
        );

        window.addEventListener("resize", () => {
            if (!activeLi) return;

            setTargetFromElement(activeLi, "pill");
            start();
        });

        backButton?.addEventListener("pointerover", () => {
            activeLi = null;
            visible = true;

            setTargetFromElement(backButton, "circle");
            blob.classList.add("is-visible");

            start();
        });

        backButton?.addEventListener("pointerleave", () => {
            visible = false;
            blob.classList.remove("is-visible");

            start();
        });
    }

    initProjectCellBlob();

    /* Unsupervised AI content */

    // rainbowShadow
    function initRainbowDirection() {
        const list = document.querySelector(".hotzone-list");
        if (!list) return;

        let previousLi = null;
        let previousCenter = null;

        list.addEventListener("pointerover", (event) => {
            const li = event.target.closest("li");
            if (!li || !list.contains(li)) return;

            // 鼠标只是在同一个 li 内部从 span 移动到别的子元素，不重新计算
            if (event.relatedTarget && li.contains(event.relatedTarget)) return;

            const label = li.querySelector(".project-label");
            if (!label) return;

            const rect = li.getBoundingClientRect();
            const currentCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            };

            // 第一次 hover，没有上一个元素，就给一个默认方向
            if (!previousCenter || previousLi === li) {
                label.style.setProperty("--rainbow-from", "200% 50%");
                label.style.setProperty("--rainbow-to", "0% 50%");
                previousCenter = currentCenter;
                previousLi = li;
                return;
            }

            const dx = currentCenter.x - previousCenter.x;
            const dy = currentCenter.y - previousCenter.y;

            const sx = Math.sign(dx);
            const sy = Math.sign(dy);

            const travel = 80;

            const fromX = 50 - sx * travel;
            const fromY = 50 - sy * travel;
            const toX = 50 + sx * travel;
            const toY = 50 + sy * travel;

            label.style.setProperty("--rainbow-from", `${fromX}% ${fromY}%`);
            label.style.setProperty("--rainbow-to", `${toX}% ${toY}%`);

            previousCenter = currentCenter;
            previousLi = li;

            // console.log({
            //     dx,
            //     dy,
            //     from: `${fromX}% ${fromY}%`,
            //     to: `${toX}% ${toY}%`,
            // });
        });
    }

    initRainbowDirection();

    // firework
    function animateCaterpillarPath(path, svg, duration = 1250) {
        const len = path.getTotalLength();
        const start = performance.now();

        path.style.strokeDasharray = `0 ${len}`;
        path.style.strokeDashoffset = "0";
        path.style.opacity = "0";

        function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        function easeInQuad(t) {
            return t * t;
        }

        function frame(now) {
            const t = Math.min(1, (now - start) / duration);

            let head;
            let tail;

            // 前端：一开始快，后面慢慢变慢
            head = len * easeOutCubic(t);

            // 后端：一开始几乎不动，后面慢慢加速
            tail = len * easeInQuad(t);

            // 防止 tail 超过 head
            tail = Math.min(tail, head);

            const visible = Math.max(0, head - tail);

            path.style.opacity = t < 0.04 ? String(t / 0.04) : "1";
            path.style.strokeDasharray = `${visible} ${len}`;
            path.style.strokeDashoffset = `${-tail}`;

            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                svg.remove();
            }
        }

        requestAnimationFrame(frame);
    }

    function triggerTitleRainbowFirework(event) {
        let layer = document.querySelector(".rainbow-firework-layer");

        if (!layer) {
            layer = document.createElement("div");
            layer.className = "rainbow-firework-layer";
            document.body.appendChild(layer);
        }

        const titleBox = document.querySelector("div.title") || event.currentTarget;
        const rect = titleBox.getBoundingClientRect();

        const u = Math.min(window.innerHeight / 100, window.innerWidth * 0.625 / 100);

        const startX = 120;
        const startY = 165;

        const originX = rect.left + rect.width / 2;
        const originY = rect.bottom + 3 * u;

        const colors = [
            "#ff2d2d",
            "#ff7a00",
            "#ffd400",
            "#39ff14",
            "#00d9ff",
            "#245bff",
            "#8b35ff",
            "#ff3bd5"
        ];

        function hexToRgba(hex, alpha) {
            const value = hex.replace("#", "");

            const r = parseInt(value.slice(0, 2), 16);
            const g = parseInt(value.slice(2, 4), 16);
            const b = parseInt(value.slice(4, 6), 16);

            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        function randomColorWithAlpha(colors) {
            const hex = colors[Math.floor(Math.random() * colors.length)];
            const alpha = 0.5 + Math.random() * 0.5; // 0.5 ~ 1

            return hexToRgba(hex, alpha.toFixed(2));
        }

        // 彩虹曲线喷射
        const curveCount = 1 + Math.floor(Math.random() * 2.15);
        const curveEnds = [];

        for (let i = 0; i < curveCount; i++) {
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

            svg.classList.add("rainbow-curve");
            svg.setAttribute("viewBox", "0 0 240 180");

            // 每条线随机一个发射方向
            // -150 到 -30 度：向左上到右上
            const angle = -130 + Math.random() * 80;
            const rad = angle * Math.PI / 180;

            // 每条线随机长度
            const length = 105 + Math.random() * 85;

            // 终点
            const endX = startX + Math.cos(rad) * length;
            const endY = startY + Math.sin(rad) * length;

            // 控制点：沿发射方向走一段，再加横向偏移制造曲线
            const curveBend = (Math.random() - 0.5) * 90;

            const c1X = startX + Math.cos(rad) * length * 0.28 + curveBend * 0.25;
            const c1Y = startY + Math.sin(rad) * length * 0.28;

            const c2X = startX + Math.cos(rad) * length * 0.72 + curveBend;
            const c2Y = startY + Math.sin(rad) * length * 0.72 + (Math.random() - 0.5) * 30;

            path.setAttribute(
                "d",
                `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`
            );

            const color = randomColorWithAlpha(colors);

            path.style.setProperty("--c", color);

            svg.style.setProperty("--x", `${originX - startX}px`);
            svg.style.setProperty("--y", `${originY - startY}px`);

            svg.appendChild(path);
            layer.appendChild(svg);

            curveEnds.push({
                x: originX - startX + endX,
                y: originY - startY + endY
            });

            // 每条线略微不同速度，更自然
            animateCaterpillarPath(
                path,
                svg,
                1100 + Math.random() * 350
            );
        }

        // 小彩点烟花：等曲线快到顶端时再出现
        setTimeout(() => {
            const dotCount = 3 + Math.floor(Math.random() * 4.5);

            for (let i = 0; i < dotCount; i++) {
                const dot = document.createElement("span");
                dot.className = "rainbow-dot";

                const color = colors[Math.floor(Math.random() * colors.length)];

                const end = curveEnds[Math.floor(Math.random() * curveEnds.length)];

                dot.style.setProperty("--x", `${end.x + (Math.random() - 0.5) * 50}px`);
                dot.style.setProperty("--y", `${end.y + (Math.random() - 0.5) * 50}px`);
                dot.style.setProperty("--s", `${1}px`);
                dot.style.setProperty("--c", color);

                // 每个星星闪烁节奏不同
                dot.style.setProperty("--duration", `${1300 + Math.random() * 1400}ms`);
                dot.style.setProperty("--delay", `${Math.random() * 260}ms`);
                dot.style.setProperty("--start-scale", `${0.25 + Math.random() * 0.5}`);

                layer.appendChild(dot);

                dot.addEventListener("animationend", () => dot.remove(), { once: true });
            }
        }, 520);
    }
    let titleFireworkClickCount = 0;

    document
        .querySelector("div.title > :is(p.title, span.title)")
        ?.addEventListener("click", (event) => {
            triggerTitleRainbowFirework(event);

            titleFireworkClickCount++;

            if (titleFireworkClickCount % 5 === 0) {
                document.dispatchEvent(new CustomEvent("title-firework-bubble"));
            }
        });

    // Background Reveal

    function initMainFrameVideoReveal() {
        const mainFrame = document.querySelector("div.mainFrame");
        const canvas = document.querySelector(".mainFrame-reveal-canvas");

        if (!mainFrame || !canvas) return;

        const ctx = canvas.getContext("2d");

        const state = {
            x: 0,
            y: 0,
            lastX: 0,
            lastY: 0,
            lastMoveTime: performance.now(),
            revealStartTime: null,
            inside: false,
            radius: 0,
            targetRadius: 0,
            started: false,
            time: 0,
        };

        const config = {
            idleDelay: 60000,
            moveThreshold: 10,
            growSpeed: 0.03,     // 蔓延速度
            revealDuration: 18000,
            shrinkSpeed: 0.03,    // 鼠标离开后的收回速度
            edgeSoftness: 0,     // 边缘柔和程度
            fillColor: "#ddd",
        };

        function paintInitialMask() {
            const rect = mainFrame.getBoundingClientRect();

            ctx.clearRect(0, 0, rect.width, rect.height);
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = config.fillColor;
            ctx.fillRect(0, 0, rect.width, rect.height);

            canvas.classList.add("is-ready");
        }

        function resizeCanvas() {
            const dpr = window.devicePixelRatio || 1;
            const rect = mainFrame.getBoundingClientRect();

            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);

            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function getMaxRadius() {
            const rect = mainFrame.getBoundingClientRect();

            const distances = [
                Math.hypot(state.x, state.y),
                Math.hypot(rect.width - state.x, state.y),
                Math.hypot(state.x, rect.height - state.y),
                Math.hypot(rect.width - state.x, rect.height - state.y),
            ];

            return Math.max(...distances) * 1.15;
        }

        function drawIrregularBlob(x, y, radius, time) {
            if (radius <= 0.5) return;

            const points = 96;
            const wobbleA = 0.13;
            const wobbleB = 0.075;
            const wobbleC = 0.045;

            ctx.save();
            ctx.globalCompositeOperation = "destination-out";

            // 让边缘柔和
            ctx.shadowBlur = config.edgeSoftness;
            ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
            ctx.fillStyle = "rgba(0, 0, 0, 1)";

            ctx.beginPath();

            const coords = [];

            for (let i = 0; i < points; i++) {
                const a = (Math.PI * 2 * i) / points;

                const n1 = Math.sin(a * 3.0 + time * 0.0018);
                const n2 = Math.sin(a * 5.0 - time * 0.0012 + 1.7);
                const n3 = Math.sin(a * 9.0 + time * 0.0025 + 0.4);

                const r =
                    radius *
                    (1 +
                        n1 * wobbleA +
                        n2 * wobbleB +
                        n3 * wobbleC);

                coords.push({
                    x: x + Math.cos(a) * r,
                    y: y + Math.sin(a) * r,
                });
            }

            // 用 quadraticCurveTo 让边界变成平滑曲面
            for (let i = 0; i < coords.length; i++) {
                const current = coords[i];
                const next = coords[(i + 1) % coords.length];

                const midX = (current.x + next.x) / 2;
                const midY = (current.y + next.y) / 2;

                if (i === 0) {
                    ctx.moveTo(midX, midY);
                } else {
                    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
                }
            }

            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        let revealRaf = 0;

        function startRevealLoop() {
            if (!revealRaf) {
                revealRaf = requestAnimationFrame(draw);
            }
        }

        function draw(now) {
            revealRaf = 0;

            state.time = now;

            const rect = mainFrame.getBoundingClientRect();

            ctx.clearRect(0, 0, rect.width, rect.height);
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = config.fillColor;
            ctx.fillRect(0, 0, rect.width, rect.height);

            const idleTime = now - state.lastMoveTime;

            if (state.inside && idleTime >= config.idleDelay) {
                state.started = true;
                state.targetRadius = getMaxRadius();
            } else if (!state.inside) {
                state.started = false;
                state.targetRadius = 0;
            }

            if (state.started) {
                if (state.revealStartTime === null) {
                    state.revealStartTime = now;
                }

                const progress = Math.min(
                    1,
                    (now - state.revealStartTime) / config.revealDuration
                );

                state.radius = state.targetRadius * Math.pow(progress, 3);
            } else {
                state.revealStartTime = null;
                state.radius += (0 - state.radius) * config.shrinkSpeed;
            }

            drawIrregularBlob(state.x, state.y, state.radius, now);

            if (state.started || state.radius > 0.5) {
                startRevealLoop();
            }
        }

        function stopReveal() {
            state.inside = false;
            state.started = false;
            state.targetRadius = 0;
            state.revealStartTime = null;
        }

        function isOverRevealBlockedArea(event) {
            const el = document.elementFromPoint(event.clientX, event.clientY);

            return !!el?.closest?.(
                ".iframe-wrapper, ul.timeList > li[data-year]"
            );
        }

        let idleTimer = 0;

        function scheduleRevealStart() {
            clearTimeout(idleTimer);

            idleTimer = setTimeout(() => {
                if (!state.inside) return;

                state.started = true;
                state.revealStartTime = null;
                state.targetRadius = getMaxRadius();

                startRevealLoop();
            }, config.idleDelay);
        }

        let lastRevealMove = 0;

        function onRevealPointerMove(event) {
            const now = performance.now();

            // 每 100ms 最多处理一次 reveal 鼠标逻辑
            if (now - lastRevealMove < 100) return;
            lastRevealMove = now;

            const rect = mainFrame.getBoundingClientRect();

            const inside =
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom;

            if (!inside || isOverRevealBlockedArea(event)) {
                stopReveal();
                return;
            }

            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const moved = Math.hypot(x - state.lastX, y - state.lastY);

            state.inside = true;
            state.x = x;
            state.y = y;

            if (moved > config.moveThreshold) {
                state.lastMoveTime = now;
                state.started = false;
                state.targetRadius = 0;
                state.revealStartTime = null;

                if (state.radius > 0.5) {
                    startRevealLoop();
                }
            }

            state.lastX = x;
            state.lastY = y;

            scheduleRevealStart();
        }

        document.addEventListener("pointermove", onRevealPointerMove, {
            passive: true
        });

        document.addEventListener("mouseleave", stopReveal);

        document.addEventListener("mouseover", (event) => {
            if (event.target.closest?.(".iframe-wrapper, ul.timeList > li[data-year]")) {
                stopReveal();
            }
        });

        resizeCanvas();
        paintInitialMask();

        window.addEventListener("resize", () => {
            resizeCanvas();
            paintInitialMask();
        });

        requestAnimationFrame(draw);
    }

    initMainFrameVideoReveal();
})
