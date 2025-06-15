// script.js

// Get references to HTML elements
const pdfUpload = document.getElementById('pdf-upload');
const bookContainer = document.getElementById('book-container');
const pageLeftDiv = document.getElementById('page-left');
const pageRightDiv = document.getElementById('page-right');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const navigationDiv = document.getElementById('navigation');

// Global variables to store PDF data
let pdfDoc = null;
let currentPageNum = 1; // Represents the left page of the current spread
let totalPages = 0;
let currentScale = 1.5; // Initial scale for rendering PDF pages

// Add a specific element for loading messages or status updates
// We can add this dynamically or assume it's in the HTML.
// For simplicity, let's create it dynamically if not present, or use an existing one.
let statusMessageDiv = document.getElementById('status-message');
if (!statusMessageDiv) {
    statusMessageDiv = document.createElement('div');
    statusMessageDiv.id = 'status-message';
    statusMessageDiv.style.textAlign = 'center';
    statusMessageDiv.style.padding = '10px';
    statusMessageDiv.style.color = '#333';
    // Insert it after the upload button, or before the book-container
    if (pdfUpload.parentNode) {
        pdfUpload.parentNode.insertBefore(statusMessageDiv, pdfUpload.nextSibling);
    }
}

// Function to display status/error messages
function showStatusMessage(message, isError = false) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.style.color = isError ? 'red' : '#333'; // Red for errors
    statusMessageDiv.style.display = 'block';
}

function hideStatusMessage() {
    statusMessageDiv.textContent = '';
    statusMessageDiv.style.display = 'none';
}


// Initialize PDF.js worker
// The workerSrc property must be set to the path of the worker script.
// This is crucial for PDF.js to work correctly.
if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
} else {
    console.error("PDF.js library not found. Ensure it's loaded before this script.");
    alert("Error: PDF.js library not loaded. The viewer may not work.");
}

// Update Event listener for file upload
pdfUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        showStatusMessage('Reading file...', false); // Feedback for reading
        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);
            loadPdf(typedarray);
        };
        fileReader.onerror = function() {
            showStatusMessage('Error reading file.', true);
            pdfUpload.style.display = 'block'; // Show input again
        }
        fileReader.readAsArrayBuffer(file);
        // pdfUpload.style.display = 'none'; // Hide input after selection - moved to loadPdf success
    } else {
        showStatusMessage('Please select a valid PDF file.', true);
        // Clear the input value if invalid file selected
        pdfUpload.value = '';
    }
});

// Update Function to load the PDF
async function loadPdf(typedarray) {
    if (!window.pdfjsLib) {
        showStatusMessage('Error: PDF.js library not available.', true);
        console.error('PDF.js is not loaded.');
        return;
    }
    try {
        showStatusMessage('Loading PDF, please wait...', false);
        pdfUpload.disabled = true; // Disable upload while processing

        pdfDoc = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
        totalPages = pdfDoc.numPages;
        console.log(`PDF loaded. Total pages: ${totalPages}`);

        if (totalPages === 0) {
            showStatusMessage('PDF is empty or could not be parsed correctly.', true);
            pdfUpload.style.display = 'block';
            pdfUpload.disabled = false;
            bookContainer.innerHTML = ''; // Clear book container
            navigationDiv.style.display = 'none';
            return;
        }

        currentPageNum = 1;

        preparePageCanvases();
        renderVisiblePages();

        navigationDiv.style.display = 'flex'; // Show navigation
        pdfUpload.style.display = 'none'; // Hide input on successful load
        hideStatusMessage(); // Clear loading message

    } catch (error) {
        console.error('Error loading PDF:', error);
        let errorMessage = 'Error loading PDF.';
        if (error.name === 'PasswordException') {
            errorMessage = 'This PDF is password protected. Please provide an unprotected PDF.';
        } else if (error.name === 'InvalidPDFException') {
            errorMessage = 'Invalid or corrupted PDF file.';
        } else {
            errorMessage = `Error loading PDF: ${error.message}`;
        }
        showStatusMessage(errorMessage, true);
        bookContainer.innerHTML = '<p style="text-align:center; color:red;">Could not display PDF.</p>'; // Clear pages
        pdfUpload.style.display = 'block'; // Show input again
        pdfUpload.disabled = false;
        navigationDiv.style.display = 'none';
    }
}

// Function to prepare canvas elements for left and right pages
// Ensure preparePageCanvases correctly adds canvases
// Find the existing preparePageCanvases function and update/verify it
function preparePageCanvases() {
    pageLeftDiv.innerHTML = '';
    pageRightDiv.innerHTML = '';

    const canvasLeft = document.createElement('canvas');
    canvasLeft.id = 'pdf-canvas-left';
    pageLeftDiv.appendChild(canvasLeft);
    pageLeftDiv.style.display = 'flex'; // Ensure visible

    // Always create right canvas structure, visibility handled by renderVisiblePages
    const canvasRight = document.createElement('canvas');
    canvasRight.id = 'pdf-canvas-right';
    pageRightDiv.appendChild(canvasRight);
    pageRightDiv.style.display = 'flex'; // Ensure visible initially, render logic will hide if needed

    // If only one page, right side will be hidden by renderVisiblePages
    if (totalPages === 1) {
        pageRightDiv.style.display = 'none';
    }
}

// Update Function to render a single page onto a given canvas
async function renderPage(pageNumToRender, canvas) {
    if (!pdfDoc || pageNumToRender < 1 || pageNumToRender > totalPages) {
        const context = canvas.getContext('2d');
        if (canvas.width > 0 && canvas.height > 0) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
        // Optionally show a message on the canvas itself if page is invalid
        // context.fillText('Invalid page', 10, 10);
        return;
    }

    try {
        const page = await pdfDoc.getPage(pageNumToRender);
        const viewport = page.getViewport({ scale: currentScale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport: viewport
        };
        await page.render(renderContext).promise;
        console.log(`Page ${pageNumToRender} rendered.`);
    } catch (error) {
        console.error(`Error rendering page ${pageNumToRender}:`, error);
        showStatusMessage(`Error rendering page ${pageNumToRender}.`, true);
        // Optionally draw an error message on the canvas
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height); // Clear previous content
        context.fillStyle = 'red';
        context.font = '16px Arial';
        context.textAlign = 'center';
        context.fillText('Error rendering page.', canvas.width / 2, canvas.height / 2);
    }
}

// Function to render the currently visible pages (left and right)
// Modify renderVisiblePages to better handle single last page on left
// Find the existing renderVisiblePages function and update it:
function renderVisiblePages() {
    if (!pdfDoc) return;

    const canvasLeft = document.getElementById('pdf-canvas-left');
    const canvasRight = document.getElementById('pdf-canvas-right');

    // Render left page
    if (canvasLeft) {
        if (currentPageNum <= totalPages) {
            renderPage(currentPageNum, canvasLeft);
            pageLeftDiv.style.display = 'flex';
        } else {
            // This case should ideally not be reached if navigation is correct
            pageLeftDiv.style.display = 'none';
        }
    }

    // Render right page
    if (canvasRight) {
        if (currentPageNum + 1 <= totalPages) {
            renderPage(currentPageNum + 1, canvasRight);
            pageRightDiv.style.display = 'flex';
        } else {
            // No more pages for the right side, clear it and hide
            const context = canvasRight.getContext('2d');
            if (canvasRight.width > 0 && canvasRight.height > 0) { // check if canvas has dimensions
                 context.clearRect(0, 0, canvasRight.width, canvasRight.height);
            }
            pageRightDiv.style.display = 'none';
        }
    } else if (totalPages === 1 && canvasLeft) { // Only one page total
        pageRightDiv.style.display = 'none';
    }

    // Handle single page view for the very last page if total pages is odd
    // and we are on the last page.
    if (totalPages % 2 !== 0 && currentPageNum === totalPages) {
        if(canvasRight) pageRightDiv.style.display = 'none';
    }
}


// Add these functions to script.js

// Function to go to the previous spread
function showPreviousPage() {
    if (!pdfDoc || currentPageNum <= 1) {
        return; // Already at the first page or no PDF loaded
    }
    // If current left page is page 1, can't go back.
    // Otherwise, move back two pages (one spread)
    currentPageNum -= 2;
    if (currentPageNum < 1) currentPageNum = 1; // Ensure it doesn't go below 1

    console.log(`Navigating to previous spread. Current left page: ${currentPageNum}`);
    renderVisiblePages();
}

// Function to go to the next spread
function showNextPage() {
    if (!pdfDoc) return; // No PDF loaded

    // Check if there are pages left to display
    // If the current left page + 2 (for the next spread's left page) is beyond total pages,
    // and also if current left page + 1 (for current spread's right page) is beyond total pages.
    if (currentPageNum + 2 > totalPages && currentPageNum + 1 >= totalPages) {
         // If on the last page or second to last page (so right page is the last one)
        if (totalPages % 2 !== 0 && currentPageNum === totalPages) {
            // Odd number of pages, and currently showing the very last page on the left. No next.
            console.log('Already at the end (odd pages, last page shown).');
            return;
        }
        if (totalPages % 2 === 0 && currentPageNum + 1 === totalPages) {
            // Even number of pages, and currently showing the last two pages. No next.
             console.log('Already at the end (even pages, last two shown).');
            return;
        }
        // Special case: if totalPages is odd and we are showing page (totalPages-1) on left,
        // then the next "page" is to show the last page on the left and nothing on the right.
        if (totalPages % 2 !== 0 && currentPageNum === totalPages - 1) {
             currentPageNum +=1; // Move to show the last page on the left.
             console.log(`Navigating to next spread (showing last page). Current left page: ${currentPageNum}`);
             renderVisiblePages();
             return;
        }

        // If we are on the last possible spread already
        if (currentPageNum + 1 >= totalPages) {
            console.log('Already at the last spread.');
            return;
        }
    }


    currentPageNum += 2;
    console.log(`Navigating to next spread. Current left page: ${currentPageNum}`);
    renderVisiblePages();
}

// Update event listeners (or add them if they were placeholders)
prevPageButton.addEventListener('click', showPreviousPage);
nextPageButton.addEventListener('click', showNextPage);
// Update event listeners (or add them if they were placeholders)
prevPageButton.addEventListener('click', showPreviousPage);
nextPageButton.addEventListener('click', showNextPage);

// Initial setup
// navigationDiv.style.display = 'none'; // Already handled
// pdfUpload.disabled = false; // Ensure it's enabled at start
// hideStatusMessage(); // Initially no message

// Make sure to call hideStatusMessage at the beginning if the div is always visible
document.addEventListener('DOMContentLoaded', () => {
    if (statusMessageDiv) { // Check if it was created/found
        hideStatusMessage();
    }
    pdfUpload.disabled = false; // Ensure it's enabled
});

// Swipe Navigation Implementation

let touchstartX = 0;
let touchendX = 0;
let touchstartY = 0;
let touchendY = 0;

// Define the minimum swipe distance (threshold)
const swipeThreshold = 50; // 50 pixels

function handleGesture() {
    const deltaX = touchendX - touchstartX;
    const deltaY = touchendY - touchstartY;

    // Check if the swipe is predominantly horizontal
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) > swipeThreshold) { // Check if swipe distance is significant
            if (touchendX < touchstartX) {
                // Swiped left
                console.log('Swiped left');
                showNextPage();
            }
            if (touchendX > touchstartX) {
                // Swiped right
                console.log('Swiped right');
                showPreviousPage();
            }
        }
    } else {
        // Optional: Handle vertical swipes if needed, for now, we ignore them for page turning
        console.log('Vertical swipe, ignored for page turning.');
    }
}

// Add touch event listeners to the book container
bookContainer.addEventListener('touchstart', (event) => {
    touchstartX = event.changedTouches[0].screenX;
    touchstartY = event.changedTouches[0].screenY;
}, false);

bookContainer.addEventListener('touchend', (event) => {
    touchendX = event.changedTouches[0].screenX;
    touchendY = event.changedTouches[0].screenY;
    handleGesture();
}, false);

// Optional: Hide navigation buttons if swipe is the primary interaction desired
// This can be done here or by uncommenting the CSS rule.
// navigationDiv.style.display = 'none';
