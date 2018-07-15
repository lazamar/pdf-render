/* globals pdfjsLib */

// -------------------------- HTML --------------------------

const PAGE_CLASS = "pdf-page";
const LOADING_CLASS = "pdf-loading";

// HTMLElement -> Void
const removeAllChildren = element => {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
};

// rangeArray(2, 5) = [2,3,4,5]
// rangeArray(1, 1) = [1]
const rangeArray = (from, to) => [...Array(to - from + 1)].map((v, idx) => idx + from);

// Creates one container element for each page.
// and adds them to the DOM.
// We do it like this so that we can make sure
// they are added in the correct order
// Int -> HTMLElement -> [HTMLElement]
const createPagesElements = (pageCount, parent) => {
    removeAllChildren(parent);

    return rangeArray(1, pageCount).map(_ => {
        const container = document.createElement("div");
        container.classList.add(PAGE_CLASS);
        parent.appendChild(container);
        return container;
    });
};

// Creates buttons to handle PDF
const prepareButtons = (zoom, rotate, blur) => {
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

    const onClick = (c, f) => document.querySelector(c).addEventListener("click", f);
    onClick(".btn-zoom-more", doZoom(1.2));
    onClick(".btn-zoom-less", doZoom(1 / 1.2));
    onClick(".btn-rotate-more", addRotation(15));
    onClick(".btn-rotate-less", addRotation(-15));
    onClick(".btn-blur-more", addBlur(2));
    onClick(".btn-blur-less", addBlur(-2));
};

// -------------------------- PDF.js --------------------------

// This function returns another function that takes
// the scale and renders the view. It is setup this way
// so that if a new render is triggered before a previous
// one has finished, we can cancel the previous one, freeing
// resources for the new render.
// HTMLElement -> Page -> Int -> Promise HTMLElement
const pageRenderer = (container, page) => {
    let currentRendering;
    let currentCanvas;

    return scale => {
        if (currentRendering) {
            currentRendering.cancel();
        }

        const viewport = page.getViewport(scale);
        const canvas = document.createElement("canvas");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const rendering = page.render({
            viewport,
            canvasContext: canvas.getContext("2d")
        });

        currentRendering = rendering;
        container.classList.add(LOADING_CLASS);

        if (currentCanvas) {
            currentCanvas.height = viewport.height;
            currentCanvas.width = viewport.width;
        }

        rendering
            .then(() => {
                if (currentRendering == rendering) {
                    removeAllChildren(container);
                    container.appendChild(canvas);
                    container.classList.remove(LOADING_CLASS);
                    currentCanvas = canvas;
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
fetch("./sample.pdf")
    .then(r => r.arrayBuffer())
    // Pass PDF data as ArrayBuffer to PDF.js
    .then(a => pdfjsLib.getDocument(a))
    // Get one Page object per document page
    .then(pdf => Promise.all(rangeArray(1, pdf.numPages).map(n => pdf.getPage(n))))
    .then(pages => {
        // We will create one container for each page.
        const containers = createPagesElements(pages.length, pdfContainer);

        const renderers = pages.map((page, idx) => pageRenderer(containers[idx], page));

        // Each time zoom is called all pages are re-rendered
        // in their container elements.
        const zoom = val => renderers.map(r => r(val));

        const rotate = val =>
            containers.map(c => {
                c.style.transform = `rotate(${val}deg)`;
            });

        const blur = val =>
            containers.map(c => {
                c.style.filter = `blur(${val}px)`;
            });

        prepareButtons(zoom, rotate, blur);

        // Now that we have the pages and containers we can just
        // render them.
        return zoom(1);
    });
