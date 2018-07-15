/* globals pdfjsLib */
/* eslint-disable no-console */

const PAGE_CLASS = "pdf-page";
const LOADING_CLASS = "pdf-loading";
// -------------------------- HTML --------------------------

// HTMLElement -> Void
const removeAllChildren = element => {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
};

// rangeArray(2, 5) = [2,3,4,5]
// rangeArray(1, 1) = [1]
const rangeArray = (from, to) =>
    [...Array(to - from + 1)].map((v, idx) => idx + from);

// Creates one container element for each page.
// and adds them to the DOM.
// We do it like this so that we can make sure
// they are added in the correct order
// Int -> HTMLElement -> [HTMLElement]
const createPagesElements = (pageCount, parent) => {
    removeAllChildren(parent);

    return rangeArray(1, pageCount)
        .map(_ => document.createElement("div"))
        .map(container => {
            container.classList.add(PAGE_CLASS);
            return container;
        })
        .map(container => parent.appendChild(container));
};

// Creates buttons to handle PDF
const createButtons = (parent, zoom, rotate, blur) => {
    let zoomLevel = 1;
    let rotation = 0;
    let blurLevel = 0;

    const doZoom = change => () => {
        zoomLevel = zoomLevel * change;
        zoom(zoomLevel);
    };
    const addRotation = change => () => {
        rotation = rotation + change;
        rotate(rotation);
    };

    const addBlur = change => () => {
        blurLevel = Math.max(0, blurLevel + change);
        blur(blurLevel);
    };

    const zoomIn = document.createElement("button");
    zoomIn.textContent = "Zoom In";
    zoomIn.addEventListener("click", doZoom(1.2));
    const zoomOut = document.createElement("button");
    zoomOut.textContent = "Zoom Out";
    zoomOut.addEventListener("click", doZoom(1 / 1.2));

    const rotateClockwise = document.createElement("button");
    rotateClockwise.textContent = "Rotate Clockwise";
    rotateClockwise.addEventListener("click", addRotation(15));
    const rotateAntiClockwise = document.createElement("button");
    rotateAntiClockwise.textContent = "Rotate AntiClockwise";
    rotateAntiClockwise.addEventListener("click", addRotation(-15));

    const blurMore = document.createElement("button");
    blurMore.textContent = "Blue more";
    blurMore.addEventListener("click", addBlur(2));
    const blurLess = document.createElement("button");
    blurLess.textContent = "Blur less";
    blurLess.addEventListener("click", addBlur(-2));

    parent.prepend(rotateClockwise);
    parent.prepend(rotateAntiClockwise);
    parent.prepend(blurMore);
    parent.prepend(blurLess);
    parent.prepend(zoomIn);
    parent.prepend(zoomOut);
};

// -------------------------- PDF.js --------------------------

// Renders the page in the given HTMLElement
// HTMLElement -> Page -> Int -> Promise HTMLElement
const pageRenderer = (container, page) => {
    let currentRendering;

    return scale => {
        currentRendering && currentRendering.cancel();
        // const renderId = Date.now() + Math.random(); // UUID
        // currentRendering = renderId;
        container.classList.add(LOADING_CLASS);

        const viewport = page.getViewport(scale);
        const canvas = document.createElement("canvas");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const rendering = page.render({
            viewport,
            canvasContext: canvas.getContext("2d")
        });
        currentRendering = rendering;
        rendering
            .then(() => {
                if (currentRendering == rendering) {
                    removeAllChildren(container);
                    container.appendChild(canvas);
                    container.classList.remove(LOADING_CLASS);
                }
            })
            // Renders error when they are cancelled so we
            // can just ignore that.
            .catch(_ => null);
    };
};

// ========= START ========

// We will add our pages inside this element
const pdfContainer = document.querySelector(".pdf-container");

// Get PDF file from url address
fetch("./sample-hard.pdf")
    .then(r => r.arrayBuffer())
    // Pass PDF data as ArrayBuffer to PDF.js
    .then(a => pdfjsLib.getDocument(a))
    // Get one Page object per document page
    .then(pdf =>
        Promise.all(rangeArray(1, pdf.numPages).map(n => pdf.getPage(n)))
    )
    .then(pages => {
        // We will create one container for each page.
        const containers = createPagesElements(pages.length, pdfContainer);

        const renderers = pages.map((page, idx) =>
            pageRenderer(containers[idx], page)
        );

        // Each time zoom is called all pages are re-rendered
        // in their container elements.
        const zoom = val => renderers.map(r => r(val));

        const rotate = val =>
            containers.map(canvas => {
                canvas.style.transform = `rotate(${val}deg)`;
            });

        const blur = val =>
            containers.map(canvas => {
                canvas.style.filter = `blur(${val}px)`;
            });

        createButtons(document.body, zoom, rotate, blur);

        // Now that we have the pages and containers we can just
        // render them.
        return zoom(1);
    });
