export function generateCertificate(studentName: string, bookTitle: string, points: number, dateStr: string) {
  const win = window.open("", "_blank", "width=1000,height=750");
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>A.R.I.S.E Reader Certificate</title>
      <style>
        @page { size: landscape; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Georgia, 'Times New Roman', serif; }
        .bg {
          width: 100vw; min-height: 100vh;
          background: linear-gradient(135deg, #e8f0fc 0%, #dbe8f8 40%, #e8f0fc 100%);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; position: relative; overflow: hidden;
        }
        /* Decorative background blobs */
        .blob-tl {
          position: absolute; top: -60px; left: -60px;
          width: 280px; height: 280px; border-radius: 50% 40% 60% 50%;
          background: linear-gradient(135deg, #ffd54f, #ffb347);
          opacity: 0.35;
        }
        .blob-br {
          position: absolute; bottom: -80px; right: -50px;
          width: 320px; height: 320px; border-radius: 50% 60% 40% 50%;
          background: linear-gradient(135deg, #6ab0f3, #4a90e2);
          opacity: 0.2;
        }
        .cert {
          width: 100%; max-width: 820px;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 8px 40px rgba(44,116,179,0.18);
          padding: 48px 56px;
          position: relative;
          z-index: 1;
        }
        /* Corner decorations */
        .corner {
          position: absolute; width: 48px; height: 48px;
          border-color: #4a90e2; border-style: solid; border-width: 0;
        }
        .corner-tl { top: 16px; left: 16px; border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 8px; }
        .corner-tr { top: 16px; right: 16px; border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 8px; }
        .corner-bl { bottom: 16px; left: 16px; border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 8px; }
        .corner-br { bottom: 16px; right: 16px; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 8px; }
        /* Inner border */
        .inner-border {
          position: absolute; top: 24px; left: 24px; right: 24px; bottom: 24px;
          border: 1.5px solid #c3d9f0; border-radius: 10px;
          pointer-events: none;
        }
        /* Header */
        .header {
          text-align: center; margin-bottom: 28px;
        }
        .logo-line {
          display: flex; align-items: center; justify-content: center; gap: 14px;
          margin-bottom: 6px;
        }
        .star {
          color: #ffb347; font-size: 22px;
        }
        .logo {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: 16px; font-weight: 800; color: #2c74b3;
          letter-spacing: 5px; text-transform: uppercase;
        }
        .logo .accent { color: #ff5900; }
        .award-title {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: 34px; font-weight: 800;
          color: #4a90e2;
          letter-spacing: 0.5px;
          margin-top: 4px;
        }
        .subtitle {
          font-style: italic; font-size: 15px; color: #555;
          margin-top: 18px; margin-bottom: 8px;
        }
        /* Student name */
        .student-name {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: 38px; font-weight: 800;
          color: #2c74b3;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 10px 0 4px;
          padding-bottom: 8px;
        }
        .name-line {
          width: 60%; margin: 0 auto;
          border-bottom: 2px solid #ccc;
          margin-bottom: 24px;
        }
        /* Body */
        .body-text {
          text-align: center; font-size: 16px; color: #333;
          line-height: 1.7; margin-bottom: 16px;
        }
        .body-text .book {
          font-style: italic; font-weight: 600; color: #2c74b3;
        }
        .points-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: linear-gradient(135deg, #fff3e0, #ffe0b2);
          border: 1.5px solid #ffb347;
          border-radius: 20px;
          padding: 6px 16px;
          font-size: 14px; font-weight: 700; color: #e67300;
          margin-top: 8px;
        }
        /* Date */
        .date-row {
          text-align: center; margin-top: 20px;
        }
        .date-row .date-label { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
        .date-row .date-value { font-size: 16px; font-weight: 700; color: #333; }
        /* Seal */
        .seal {
          width: 70px; height: 70px; border-radius: 50%;
          background: linear-gradient(135deg, #4a90e2, #2c74b3);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 4px 12px rgba(44,116,179,0.3);
        }
        .seal-inner {
          width: 56px; height: 56px; border-radius: 50%;
          border: 2px solid #fff;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 9px; font-weight: 800;
          text-align: center; line-height: 1.3;
        }
        /* Signature */
        .signature-area {
          display: flex; justify-content: space-between;
          margin-top: 32px; padding: 0 20px;
        }
        .sig-block { text-align: center; width: 200px; }
        .sig-line { border-bottom: 2px solid #888; margin-bottom: 6px; height: 40px; }
        .sig-name {
          font-family: 'Brush Script MT', cursive, Georgia;
          font-size: 22px; color: #2c74b3;
          line-height: 40px;
        }
        .sig-title { font-size: 11px; font-style: italic; color: #666; }
        /* Print button */
        .print-btn {
          display: block; margin: 24px auto 0;
          padding: 12px 36px;
          background: linear-gradient(135deg, #ff5900, #e67300);
          color: #fff; border: none; border-radius: 8px;
          font-size: 16px; font-weight: 700; cursor: pointer;
          font-family: 'Helvetica Neue', Arial, sans-serif;
          box-shadow: 0 4px 12px rgba(255,89,0,0.25);
          transition: transform 0.15s;
        }
        .print-btn:hover { transform: translateY(-1px); }
        @media print { .print-btn { display: none; } .bg { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="bg">
        <div class="blob-tl"></div>
        <div class="blob-br"></div>
        <div class="cert">
          <div class="inner-border"></div>
          <div class="corner corner-tl"></div>
          <div class="corner corner-tr"></div>
          <div class="corner corner-bl"></div>
          <div class="corner corner-br"></div>

          <div class="header">
            <div class="logo-line">
              <span class="star">&#9733;</span>
              <span class="logo">A.R.I.S.E <span class="accent">READER</span></span>
              <span class="star">&#9733;</span>
            </div>
            <h1 class="award-title">Reading Achievement Award</h1>
            <p class="subtitle">This certificate is proudly presented to</p>
          </div>

          <div class="student-name">${studentName}</div>
          <div class="name-line"></div>

          <div class="body-text">
            For demonstrating exceptional dedication, effort, and excellence<br>
            in reading comprehension for the book
          </div>
          <div class="body-text">
            <span class="book">"${bookTitle}"</span>
          </div>

          <div style="text-align:center;">
            <div class="points-badge">
              &#9733; ${points} Points Earned
            </div>
          </div>

          <div class="date-row">
            <div class="date-label">Date</div>
            <div class="date-value">${dateStr}</div>
          </div>

          <div class="seal">
            <div class="seal-inner">A.R.I.S.E<br>READER</div>
          </div>

          <div class="signature-area">
            <div class="sig-block">
              <div class="sig-line"><span class="sig-name">Jermaine</span></div>
              <div class="sig-title">A.R.I.S.E Director</div>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-title">Student Signature</div>
            </div>
          </div>

          <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        </div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
}
