import type Konva from "konva";
import { jsPDF } from "jspdf";

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Export the current Konva stage to a PNG download. */
export function exportStagePng(stage: Konva.Stage, name = "bubble-diagram") {
  const dataUrl = stage.toDataURL({ pixelRatio: 2 });
  triggerDownload(dataUrl, `${name}.png`);
}

/** Export the current Konva stage to a single-page PDF sized to the canvas. */
export function exportStagePdf(stage: Konva.Stage, name = "bubble-diagram") {
  const dataUrl = stage.toDataURL({ pixelRatio: 2 });
  const width = stage.width();
  const height = stage.height();
  const orientation = width >= height ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "px",
    format: [width, height],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
  pdf.save(`${name}.pdf`);
}
