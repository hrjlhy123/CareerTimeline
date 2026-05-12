import { getData } from "./3D_model_3.js";
import { getCoordinates, getRotations } from "./tools/calculate.js"

"use strict";
window.addEventListener("DOMContentLoaded", async () => {

    let frame,
        data, li,
        x, y, z,
        coordinates,
        angle

    li = document.querySelectorAll('ul.timeList > li[data-year]');
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
                    translate3d(-50%, -50%, 0)
                    rotateX(${angle.global.rx}deg)
                    rotateY(${angle.global.ry}deg)
                    rotateZ(${angle.global.rz}deg)
                    rotateX(${angle.local.rx}deg)
                    rotateY(${angle.local.ry}deg)
                    rotateZ(${angle.local.rz}deg)
                `;

                // if (data.modelStates[index].center.z + data.modelStates[index].translation.z < data.results.center[2] - 0.5) {
                //     item.style.visibility = `initial`
                // } else {
                //     item.style.visibility = `hidden`
                // }
                const zFront =
                    data.modelStates[index].center.z + data.modelStates[index].translation.z <
                    data.results.center[2] - 0.5;

                const localRx =
                    data.modelStates[index].angle.rx -
                    data.modelStates[index].deltaAngle.rx;

                // 1 = 正面，0 = 侧面，-1 = 背面
                const facing = Math.cos(localRx);

                // 这个值越大，隐藏越早
                const isFrontFacing = facing > 0.18;

                if (zFront && isFrontFacing) {
                    item.style.visibility = "initial";
                } else {
                    item.style.visibility = "hidden";
                }

            })
        }
        requestAnimationFrame(frame)
    }
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
    let hotzone = document.querySelector(`div.hotzone`)
    let playzone = document.querySelector(`div.playzone`)
    let iframeWrappers = document.querySelectorAll(`div.iframe-wrapper`)
    let iframeMasks = document.querySelectorAll(`div.iframe-mask`)

    let year
    li.forEach((item, index) => {
        item.addEventListener(`click`, async (event) => {
            item.parentNode.querySelectorAll('.checked').forEach(el => el.classList.remove('checked'));
            item.classList.add('checked');
            year = item.getAttribute('data-year');
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

    /* Unsupervised AI content */

    let showcaseEventsBound = false;
    let animating = false;
    let openingId = 0;

    function closeProjectShowcase() {
        const projectShowcase = document.querySelector("div.projectShowcase");
        const iframeWrappers = document.querySelectorAll("div.iframe-wrapper");

        openingId++;
        animating = false;

        projectShowcase?.classList.remove("active");

        iframeWrappers.forEach((wrapper) => {
            wrapper.classList.remove("effect-ready");
            wrapper.classList.remove("active");
            wrapper.querySelector("iframe")?.classList.remove("show");

            wrapper.style.pointerEvents = "none";

            setTimeout(() => {
                wrapper.style.pointerEvents = "initial";
            }, 300);
        });
    }

    const bindIframeEvents = () => {
        if (showcaseEventsBound) return;
        showcaseEventsBound = true;

        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        const projectShowcase = document.querySelector("div.projectShowcase");
        const playzone = document.querySelector("div.playzone");

        if (!projectShowcase || !playzone) return;

        playzone.addEventListener("click", async (event) => {
            const mask = event.target.closest(".iframe-mask");
            if (!mask || !playzone.contains(mask)) return;

            event.stopPropagation();

            if (animating) return;
            animating = true;

            const currentOpeningId = ++openingId;
            const iframeWrappers = Array.from(document.querySelectorAll("div.iframe-wrapper"));

            projectShowcase.classList.add("active");

            for (let i = iframeWrappers.length - 1; i >= 0; i--) {
                if (currentOpeningId !== openingId) {
                    animating = false;
                    return;
                }

                iframeWrappers[i].classList.add("active");

                await sleep(50);
            }

            await sleep(50);

            for (let i = 0; i < iframeWrappers.length; i++) {
                if (currentOpeningId !== openingId) {
                    animating = false;
                    return;
                }

                await sleep(200);

                if (currentOpeningId !== openingId) {
                    animating = false;
                    return;
                }

                const wrapper = iframeWrappers[i];
                wrapper.querySelector("iframe")?.classList.add("show");
                wrapper.classList.add("effect-ready");
            }

            if (currentOpeningId === openingId) {
                animating = false;
            }
        });

        document.addEventListener("click", (event) => {
            if (!projectShowcase.classList.contains("active")) return;

            const clickedActiveWrapper = event.target.closest(".iframe-wrapper.active");
            if (clickedActiveWrapper) return;

            closeProjectShowcase();
        });
    };

    bindIframeEvents();

    /* Unsupervised AI content */

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
    const YEAR_COLOR_LAG_PX = 10;
    function getYearCssVar(year, varName, fallback = "") {
        const source = document.querySelector(`ul.timeList > li[data-year="${year}"]`);

        if (!source) return fallback;

        const value = getComputedStyle(source).getPropertyValue(varName).trim();

        return value || fallback;
    }
    let yearColorRippleRaf = 0;
    let yearColorRippleToken = 0;

    function triggerYearColorRipple(targetYear, event, onDone) {
        const playzone = document.querySelector(".playzone");
        if (!playzone || !targetYear) return;

        yearColorRippleToken++;
        const token = yearColorRippleToken;

        if (yearColorRippleRaf) {
            cancelAnimationFrame(yearColorRippleRaf);
            yearColorRippleRaf = 0;
        }

        const yearRgb = getYearCssVar(targetYear, "--year-rgb", "255 255 255");

        const rect = playzone.getBoundingClientRect();

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

        playzone.classList.add("year-color-rippling");
        playzone.style.setProperty("--year-ripple-x", `${clickX}px`);
        playzone.style.setProperty("--year-ripple-y", `${clickY}px`);
        playzone.style.setProperty("--year-ripple-rgb", yearRgb);
        playzone.style.setProperty("--year-ripple-alpha", "0.2");
        playzone.style.setProperty("--year-ripple-radius", "0px");

        const start = performance.now();
        const duration = PROJECT_RIPPLE_DURATION;

        let dataDateApplied = false;
        const DATA_DATE_APPLY_TIME = 1550;

        function animate(now) {
            if (token !== yearColorRippleToken) return;

            const t = Math.min(1, Math.max(0, (now - start) / duration));
            const elapsed = now - start;

            if (!dataDateApplied && elapsed >= DATA_DATE_APPLY_TIME) {
                playzone.setAttribute("data-year", String(targetYear));
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

            playzone.style.setProperty("--year-ripple-radius", `${radius}px`);
            playzone.style.setProperty("--year-ripple-alpha", alpha.toFixed(3));

            if (t < 1) {
                yearColorRippleRaf = requestAnimationFrame(animate);
            } else {
                if (!dataDateApplied) {
                    playzone.setAttribute("data-year", String(targetYear));
                    dataDateApplied = true;
                }

                playzone.setAttribute("data-year", String(targetYear));

                playzone.classList.remove("year-color-rippling");

                playzone.style.removeProperty("--year-ripple-x");
                playzone.style.removeProperty("--year-ripple-y");
                playzone.style.removeProperty("--year-ripple-rgb");
                playzone.style.removeProperty("--year-ripple-alpha");
                playzone.style.removeProperty("--year-ripple-radius");

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

    function renderSingleProjectInPlayzone(project) {
        const playzone = document.querySelector(".playzone");

        if (!playzone || !project) return;

        const { name, URLs } = project;
        const firstURL = URLs?.[0] || "about:blank";
        const isMobile = name.trim().endsWith("(mobile)");
        const iframeClass = isMobile ? "projectShowcase mobile" : "projectShowcase";

        _clearAllRotators();

        playzone.innerHTML = "";

        playzone.insertAdjacentHTML(
            "beforeend",
            `
        <div class="iframe-wrapper">
            <iframe class="${iframeClass}" src="${firstURL}" frameborder="0" tabindex="0"></iframe>
            <div class="iframe-mask"></div>
        </div>
        `
        );

        const wrapper = playzone.lastElementChild;
        const iframeEl = wrapper.querySelector("iframe");

        _attachRotator(iframeEl, URLs, 4000);
        applyStackVars(playzone, 1);
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

    // 你说 2024 居中时 top 大约是 231.775，所以先取 232
    const TIMELINE_TARGET_TOP = 232;
    const TIMELINE_CENTER_TOLERANCE = 2;

    // 如果方向反了，把这个改成 -1
    const TIMELINE_WHEEL_DIRECTION = -1;

    function isTimelineYearFront(year) {
        const item = document.querySelector(`ul.timeList > li[data-year="${year}"]`);
        if (!item) return false;

        // 你的 frame loop 里，背面年份会被设为 hidden，正面会是 initial
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
    }

    function centerTimelineYearStep() {
        timelineCenterRaf = 0;

        const year = timelineCenterTargetYear;
        if (!year) return;

        const item = document.querySelector(`ul.timeList > li[data-year="${year}"]`);
        const canvas = document.querySelector("canvas.timelineBelt");

        if (!item || !canvas) return;

        // 注意：你的 li top 是每帧由 3D 坐标计算出来的，所以直接读 style.top 最稳定
        const currentTop = parseFloat(item.style.top);

        if (!Number.isFinite(currentTop)) {
            timelineCenterRaf = requestAnimationFrame(centerTimelineYearStep);
            return;
        }

        const diff = currentTop - TIMELINE_TARGET_TOP;

        if (Math.abs(diff) <= TIMELINE_CENTER_TOLERANCE) {
            return;
        }

        // 模拟滚轮，复用 3D_model_3.js 里已有的 wheel → deltaAngle 逻辑
        const deltaY = TIMELINE_WHEEL_DIRECTION * Math.max(
            -80,
            Math.min(80, diff * 0.45)
        );

        canvas.dispatchEvent(
            new WheelEvent("wheel", {
                deltaY,
                bubbles: true,
                cancelable: true,
            })
        );

        timelineCenterRaf = requestAnimationFrame(centerTimelineYearStep);
    }

    let projectListClickBound = false;
    let projectListHoverBound = false;
    let lastHoverTimelineYear = null;
    let currentProjects = [];

    const renderProjects = (year, projects) => {
        const hotzoneList = document.querySelector('.hotzone-list');
        const playzone = document.querySelector('.playzone');

        _clearAllRotators();

        currentProjects = projects;
        currentRenderYear = year;
        // console.log(`year:`, year)

        if (year != `all`) {
            // ✅ 清空
            hotzoneList.innerHTML = '';
            playzone.innerHTML = '';

            projects.forEach(({ name, URLs }, index) => {
                const firstURL = URLs?.[0] || 'about:blank';
                const isMobile = name.trim().endsWith('(mobile)');
                const iframeClass = isMobile ? 'projectShowcase mobile' : 'projectShowcase';

                playzone.setAttribute("data-year", year);

                hotzoneList.insertAdjacentHTML(
                    'beforeend',
                    `<li data-project-index="${index}" data-year="${year}">
                        <span class="project-label"></span>
                    </li>`
                );

                const label = hotzoneList.lastElementChild.lastElementChild;
                label.textContent = name;
                label.dataset.text = name;

                playzone.insertAdjacentHTML('beforeend', `
                    <div class="iframe-wrapper">
                        <iframe class="${iframeClass}" src="${firstURL}" frameborder="0" tabindex="0"></iframe>
                        <div class="iframe-mask"></div>
                    </div>
                `);

                // 给刚插入的 iframe 开启轮播
                const wrapper = playzone.lastElementChild;
                const iframeEl = wrapper.querySelector('iframe');
                _attachRotator(iframeEl, URLs, 4000); // ms
            });



            applyStackVars(playzone, projects.length);

        } else {
            hotzoneList.innerHTML = '';

            projects.forEach(({ name, year }, index) => {
                hotzoneList.insertAdjacentHTML(
                    'beforeend',
                    `<li data-project-index="${index}" data-year="${year}">
                        <span class="project-label"></span>
                    </li>`
                );

                const label = hotzoneList.lastElementChild.lastElementChild;
                label.textContent = name;
                label.dataset.text = name;
            });
        }

        if (!projectListClickBound) {
            projectListClickBound = true;

            hotzoneList.addEventListener("click", (event) => {
                event.stopPropagation();

                const li = event.target.closest("li");
                if (!li || !hotzoneList.contains(li)) return;

                const index = Number(li.dataset.projectIndex);
                const project = currentProjects[index];

                if (!project) return;

                const targetYear = getProjectYear(project);

                // 先切换 iframe 内容
                renderSingleProjectInPlayzone(project);

                setCheckedTimelineYear(targetYear);

                // 空间涟漪：仍然作用在整个 projectShowcase
                const showcaseArea = document.querySelector("div.projectShowcase");
                triggerProjectListRipple(showcaseArea, event);

                // 颜色涟漪：只作用在 playzone > iframe-wrapper
                // 动画结束后才正式切换 playzone data-year
                triggerYearColorRipple(targetYear, event);
            });
        }

        if (!projectListHoverBound) {
            projectListHoverBound = true;

            hotzoneList.addEventListener("pointerover", (event) => {
                const projectLi = event.target.closest("li[data-year]");
                if (!projectLi || !hotzoneList.contains(projectLi)) return;

                // 同一个 li 内部移动，不重复触发
                if (event.relatedTarget && projectLi.contains(event.relatedTarget)) return;

                const year = projectLi.dataset.year;

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

    /* Unsupervised AI content */

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

            console.log({
                dx,
                dy,
                from: `${fromX}% ${fromY}%`,
                to: `${toX}% ${toY}%`,
            });
        });
    }

    initRainbowDirection();

    // test
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

        const title = event.currentTarget;
        const rect = title.getBoundingClientRect();

        const originX = rect.left + rect.width / 2;
        const originY = rect.top + rect.height * 0.45;

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

            // 起点在 SVG 底部中间
            const startX = 120;
            const startY = 165;

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

            svg.style.setProperty("--x", `${originX - 120}px`);
            svg.style.setProperty("--y", `${originY - 160}px`);

            svg.appendChild(path);
            layer.appendChild(svg);

            curveEnds.push({
                x: originX - 120 + endX,
                y: originY - 160 + endY
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
    document
        .querySelector("span.title")
        ?.addEventListener("click", triggerTitleRainbowFirework);
})