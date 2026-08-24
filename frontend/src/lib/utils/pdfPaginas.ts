import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function cargarPdf(datos: ArrayBuffer): Promise<PDFDocumentProxy> {
	return pdfjsLib.getDocument({ data: datos }).promise;
}

// Renderiza una pagina a un data URL (JPEG) del ancho pedido, alto
// proporcional -- se usa como <img> en la grilla de miniaturas, mas simple
// de integrar en el markup reactivo que mantener <canvas> vivos a mano.
export async function renderizarPaginaComoImagen(pdf: PDFDocumentProxy, numero: number, anchoObjetivo: number): Promise<string> {
	const pagina = await pdf.getPage(numero);
	const base = pagina.getViewport({ scale: 1 });
	const viewport = pagina.getViewport({ scale: anchoObjetivo / base.width });

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(viewport.width);
	canvas.height = Math.round(viewport.height);
	const canvasContext = canvas.getContext('2d')!;
	await pagina.render({ canvas, canvasContext, viewport }).promise;
	return canvas.toDataURL('image/jpeg', 0.85);
}
