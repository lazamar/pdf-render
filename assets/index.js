/* globals pdfjsLib, RF */
/* eslint-disable no-console */

// Get the Future monad from Ramada-Fantasy
const { Future } = RF;

// Transorm a Promise in a Future which, if failed, will
// error with a given message
// String -> Promise a -> Future Err a
const toFuture = (message, promise) =>
    Future((reject, resolve) =>
        promise.then(resolve).catch(error => reject({ message, error }))
    );

// Call Futures in parallel
// If one fails all fail
// [Future a] -> Future [a]
const parallel = futures => {
    const stop = Date.now() + Math.random(); // UUID
    const inParallel = acc => future =>
        future !== stop ? inParallel(acc.concat([future])) : acc;

    return futures
        .reduce((acc, f) => acc.ap(f), Future.of(inParallel([])))
        .map(func => func(stop));
};

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
// Int -> HTMLElement -> Future Err [HTMLElement]
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
        zoom(zoomLevel).fork(console.log, console.log);
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

// Ger a specific page form a PDF document
// Int -> PDF -> Future Err Page
const getPage = (pageNumber, pdf) =>
    toFuture(`Unable to get page ${pageNumber}`, pdf.getPage(pageNumber));

// Renders the page in the given HTMLElement
// HTMLElement -> Page -> Int -> Future Err HTMLElement
const renderPage = (canvas, page, scale) => {
    const viewport = page.getViewport(scale);
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    return toFuture(
        "Error rendering page",
        page
            .render({ viewport, canvasContext: canvas.getContext("2d") })
            .then(() => canvas)
    );
};

// Create a PDF object from a specific source.
// Source can be an ArrayBuffer or a URL string.
// ArrayBuffer -> Future Err PDF
const getDocument = source =>
    toFuture("Unable to load Document", pdfjsLib.getDocument(source));

// Downloads a resource and converts it to an ArrayBuffer
// String -> Future Err ArrayBuffer
const fetchAsArrayBuffer = url =>
    toFuture("Unable to fetch PDF", fetch(url).then(r => r.arrayBuffer()));

// ========= START ========

const pdfContainer = document.querySelector(".pdf-container");

fetchAsArrayBuffer("./sample.pdf") // Get PDF file from url address
    .chain(getDocument) // Pass PDF data as ArrayBuffer to PDF.js
    .chain((
        pdf // Get one Page object per document page
    ) => parallel(rangeArray(1, pdf.numPages).map(n => getPage(n, pdf))))
    .chain(pages => {
        // Now that we have the pages we can just
        // render them in a canvas element
        const canvasses = createPagesElements(pages.length, pdfContainer);

        const zoom = val =>
            parallel(
                pages.map((page, idx) => renderPage(canvasses[idx], page, val))
            );

        const rotate = val =>
            canvasses.map(canvas => {
                canvas.style.transform = `rotate(${val}deg)`;
            });

        const blur = val =>
            canvasses.map(canvas => {
                canvas.style.filter = `blur(${val}px)`;
            });

        createButtons(document.body, zoom, rotate, blur);
        return zoom(1);
    })
    .fork(console.log, console.log);
