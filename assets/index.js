/* globals pdfjsLib */
/* eslint-disable no-console */

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

// Creates one canvas element for each page.
// and adds them to the DOM.
// We do it like this so that we can make sure
// they are added in the correct order
// Int -> HTMLElement -> [HTMLElement]
const createPagesElements = (pageCount, parent) => {
    removeAllChildren(parent);

    return rangeArray(1, pageCount)
        .map(_ => document.createElement("canvas"))
        .map(canvas => parent.appendChild(canvas));
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
// HTMLElement -> Page -> Int -> Future Err HTMLElement
const renderPage = (canvas, page, scale) => {
    const viewport = page.getViewport(scale);
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    return page
        .render({ viewport, canvasContext: canvas.getContext("2d") })
        .then(() => canvas);
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
    .then(pdf =>
        Promise.all(rangeArray(1, pdf.numPages).map(n => pdf.getPage(n)))
    )
    .then(pages => {
        // We will create one canvas for each page.
        const canvasses = createPagesElements(pages.length, pdfContainer);

        // Each time zoom is called all pages are re-rendered
        // in their canvas elements.
        const zoom = val =>
            pages.map((page, idx) => renderPage(canvasses[idx], page, val));

        const rotate = val =>
            canvasses.map(canvas => {
                canvas.style.transform = `rotate(${val}deg)`;
            });

        const blur = val =>
            canvasses.map(canvas => {
                canvas.style.filter = `blur(${val}px)`;
            });

        createButtons(document.body, zoom, rotate, blur);

        // Now that we have the pages and canvasses we can just
        // render them.
        return zoom(1);
    });
