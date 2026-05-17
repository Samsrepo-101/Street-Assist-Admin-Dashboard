/**
 * exportReportPDF.js
 * Generates a formal, printable PDF for a single Street Assist report.
 * Uses jsPDF (already installed). Images are fetched from Cloudinary URLs
 * and embedded as base64 — no external dependencies needed.
 */

import jsPDF from 'jspdf';
import { format } from 'date-fns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetches an image URL and returns a base64 data URL.
 * Returns null if the fetch fails (broken URL, CORS, etc.).
 *
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Returns the natural dimensions of a base64 image.
 * Falls back to { width: 1, height: 1 } on error.
 *
 * @param {string} base64
 * @returns {Promise<{ width: number, height: number }>}
 */
function getImageDimensions(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = base64;
  });
}

/**
 * Formats a Firestore Timestamp or Date to a readable string.
 */
function fmtTs(ts) {
  if (!ts) return 'N/A';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return format(d, 'MMMM dd, yyyy · hh:mm a');
  } catch {
    return 'N/A';
  }
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const PAGE_W = 210;   // A4 mm
const PAGE_H = 297;
const MARGIN  = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Colours (RGB)
const C = {
  headerBg:   [30, 30, 30],     // elegant charcoal
  headerText: [255, 255, 255],
  sectionBg:  [240, 240, 240],   // formal gray header bars
  border:     [200, 200, 200],   // structured gray borders
  label:      [80, 80, 80],      // clear labeling tone
  value:      [0, 0, 0],         // deep black for optimal contrast and readability
  divider:    [220, 220, 220],   // clean horizontal lines
  footerText: [120, 120, 120],   // discrete footer gray
  accent:     [0, 0, 0],         // black accent
};

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Generates and downloads a formal PDF for a single report.
 *
 * @param {object} report - The mapped report object from Firestore
 * @returns {Promise<void>}
 */
export async function exportReportPDF(report) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const generatedAt = format(new Date(), 'MMMM dd, yyyy · hh:mm a');
  const reportId = report.reportId || report.report_id || report.id || 'UNKNOWN';

  let y = 0; // current Y cursor

  // ── Helper: add a new page if needed ──────────────────────────────────────
  function checkPage(needed = 20) {
    if (y + needed > PAGE_H - 20) {
      doc.addPage();
      y = MARGIN;
    }
  }

  // ── Helper: draw a horizontal rule ────────────────────────────────────────
  function hRule(yPos, color = C.divider) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, yPos, PAGE_W - MARGIN, yPos);
  }

  // ── Helper: draw a label-value row ────────────────────────────────────────
  function labelValue(label, value) {
    const labelText = String(label || '').toUpperCase();
    const valueText = String(value || 'N/A');

    // Split value text to fit the right column
    const rightColW = CONTENT_W - 45; // 45mm for label column
    const lines = doc.splitTextToSize(valueText, rightColW);

    // Calculate row height based on number of lines
    const rowH = Math.max(8, lines.length * 5 + 3);

    // Check if we need a new page for this row
    checkPage(rowH);

    // Draw label (bold, gray)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.label);
    doc.text(labelText, MARGIN, y + 5);

    // Draw value (normal, black)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.value);
    doc.text(lines, MARGIN + 45, y + 5);

    // Draw bottom border line
    y += rowH;
    hRule(y);
  }

  // ── Helper: section heading ────────────────────────────────────────────────
  function sectionHeading(title, yPos) {
    doc.setFillColor(...C.sectionBg);
    doc.rect(MARGIN, yPos, CONTENT_W, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.accent);
    doc.text(title, MARGIN + 2, yPos + 5);
    return yPos + 10;
  }

  // =========================================================================
  // 1. HEADER
  // =========================================================================
  doc.setFillColor(...C.headerBg);
  doc.rect(0, 0, PAGE_W, 38, 'F');

  // Logo placeholder (small square)
  doc.setFillColor(255, 255, 255, 0.15);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN, 7, 14, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.headerText);
  doc.text('SA', MARGIN + 4, 16);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.headerText);
  doc.text('STREET ASSIST REPORT SYSTEM', MARGIN + 18, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Incident Report — Camarines Norte Community Safety Platform', MARGIN + 18, 20);

  // Report ID + generated time (right-aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(reportId, PAGE_W - MARGIN, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Generated: ${generatedAt}`, PAGE_W - MARGIN, 20, { align: 'right' });

  // Status badge in header
  const statusLabel = report.status || 'Unknown';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.headerText);
  doc.text(`STATUS: ${statusLabel.toUpperCase()}`, MARGIN + 18, 30);

  y = 46;

  // =========================================================================
  // 2. REPORT DETAILS
  // =========================================================================
  y = sectionHeading('REPORT DETAILS', y);

  const reportDate = fmtTs(report.seenAt ?? report.timestamp);
  const location = report.locationAddress || report.location_address ||
    (report.latitude && report.longitude
      ? `${Number(report.latitude).toFixed(5)}, ${Number(report.longitude).toFixed(5)}`
      : 'Not provided');

  const details = [
    ['Report ID',    reportId],
    ['Category',     report.reportType || report.category || 'N/A'],
    ['Status',       statusLabel],
    ['Date & Time',  reportDate],
    ['Reporter',     report.fullName || report.reporter_name || 'Anonymous'],
    ['Contact',      report.contactNumber || report.reporter_email || 'N/A'],
    ['Location',     location],
    ['User ID',      report.userId || 'N/A'],
  ];

  if (report.sex)             details.push(['Sex',          report.sex]);
  if (report.approximateAge)  details.push(['Approx. Age',  report.approximateAge]);

  for (const [label, value] of details) {
    labelValue(label, value);
  }

  y += 4;

  // =========================================================================
  // 3. DESCRIPTION
  // =========================================================================
  checkPage(20);
  y = sectionHeading('INCIDENT DESCRIPTION', y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.value);
  const descLines = doc.splitTextToSize(report.description || 'No description provided.', CONTENT_W);
  doc.text(descLines, MARGIN, y);
  y += descLines.length * 5.5 + 4;

  if (report.assistanceDescription && report.assistanceDescription !== report.description) {
    checkPage(12);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.label);
    const addLines = doc.splitTextToSize(`Additional: ${report.assistanceDescription}`, CONTENT_W);
    doc.text(addLines, MARGIN, y);
    y += addLines.length * 5 + 4;
  }

  // =========================================================================
  // 4. ATTACHMENT IMAGES
  // =========================================================================
  checkPage(20);
  y = sectionHeading('ATTACHED IMAGES', y);

  const attachments = Array.isArray(report.attachments) ? report.attachments.filter(Boolean) : [];

  if (attachments.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...C.label);
    doc.text('No attached images.', MARGIN, y);
    y += 8;
  } else {
    // Load all images concurrently
    const imageData = await Promise.all(
      attachments.map(url => fetchImageAsBase64(url))
    );

    const imgW = (CONTENT_W - 4) / 2; // 2 per row with 4mm gap
    let col = 0;
    let rowStartY = y;
    let rowMaxH = 0;

    for (let i = 0; i < imageData.length; i++) {
      const b64 = imageData[i];
      const xPos = MARGIN + col * (imgW + 4);

      if (b64) {
        const dims = await getImageDimensions(b64);
        const aspect = dims.height / dims.width;
        let renderW = imgW;
        let renderH = imgW * aspect;
        if (renderH > 60) {
          renderH = 60;
          renderW = renderH / aspect;
        }

        checkPage(renderH + 8);
        if (col === 0) {
          rowStartY = y;
          rowMaxH = 0;
        }
        rowMaxH = Math.max(rowMaxH, renderH);

        const cellCenterX = xPos + imgW / 2;
        const renderX = cellCenterX - renderW / 2;

        try {
          const fmt = b64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          doc.addImage(b64, fmt, renderX, y, renderW, renderH);
        } catch {
          // Image failed to embed — draw placeholder
          doc.setFillColor(240, 240, 240);
          doc.rect(xPos, y, imgW, 30, 'F');
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(...C.label);
          doc.text('Image unavailable', xPos + 2, y + 16);
          rowMaxH = Math.max(rowMaxH, 30);
        }

        // Image number label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...C.label);
        doc.text(`Image ${i + 1}`, xPos, y + rowMaxH + 4);

        col++;
        if (col === 2) {
          // Move to next row
          y = rowStartY + rowMaxH + 10;
          col = 0;
        }
      } else {
        // Broken image placeholder
        checkPage(36);
        if (col === 0) {
          rowStartY = y;
          rowMaxH = 0;
        }
        rowMaxH = Math.max(rowMaxH, 30);

        doc.setFillColor(240, 240, 240);
        doc.rect(xPos, y, imgW, 30, 'F');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(...C.label);
        doc.text('Image unavailable', xPos + 2, y + 16);
        doc.text(`Image ${i + 1}`, xPos, y + 34);

        col++;
        if (col === 2) {
          y = rowStartY + rowMaxH + 10;
          col = 0;
        }
      }
    }

    // If last row had only 1 image, advance y
    if (col === 1) {
      y = rowStartY + rowMaxH + 10;
    }
    y += 4;
  }

  // =========================================================================
  // 5. ADMIN NOTES
  // =========================================================================
  const adminNotes = report.adminNotes || report.admin_notes || '';
  if (adminNotes) {
    checkPage(20);
    y = sectionHeading('ADMIN NOTES', y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.value);
    const noteLines = doc.splitTextToSize(adminNotes, CONTENT_W);
    doc.text(noteLines, MARGIN, y);
    y += noteLines.length * 5.5 + 4;
  }

  // Resolution info
  if (report.resolutionTimestamp) {
    checkPage(12);
    y = sectionHeading('RESOLUTION', y);
    labelValue('Resolved On', fmtTs(report.resolutionTimestamp));
    if (report.resolvedByUserId) {
      labelValue('Resolved By', report.resolvedByUserId);
    }
    y += 4;
  }

  // =========================================================================
  // 6. FOOTER (on every page)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = PAGE_H - 10;
    hRule(footerY - 4, C.divider);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.footerText);
    doc.text('Generated by Street Assist Admin Dashboard — Camarines Norte', MARGIN, footerY);
    doc.text(`${generatedAt}  |  Page ${p} of ${totalPages}`, PAGE_W - MARGIN, footerY, { align: 'right' });
  }

  // =========================================================================
  // Save
  // =========================================================================
  const filename = `StreetAssist-Report-${reportId}-${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
}
