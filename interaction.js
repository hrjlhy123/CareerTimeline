import { getModelStates } from "./3D_model_3.js";

let frame,
    modelStates, li
frame = async () => {
    modelStates = await getModelStates()
    // console.log(`interaction:`, modelStates)
    li = document.querySelector('li[data-date="2018"]');
    if (modelStates) {
        Object.assign(li.style, {
            left: (modelStates[0].center.x + modelStates[0].translation.x) * 10 + 755 + 'px',
            top: (modelStates[0].center.y + modelStates[0].translation.y) * 10 + 250 + 'px',
        })

        // console.log(`li.style:`, li.style.left, li.style.top)
        // console.log(`li.style:`, modelStates[0].center.x + modelStates[0].translation.x * 10, modelStates[0].center.y + modelStates[0].translation.y * 10)
    }
    requestAnimationFrame(frame)
}
frame()