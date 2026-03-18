type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

interface PdfJsRuntimeConfig {
  moduleUrl: string;
  workerUrl: string;
  standardFontDataUrl: string;
}

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let pdfJsRuntimeConfigPromise: Promise<PdfJsRuntimeConfig> | null = null;

const getPdfJsRuntimeConfig = async (): Promise<PdfJsRuntimeConfig> => {
  if (!pdfJsRuntimeConfigPromise) {
    pdfJsRuntimeConfigPromise = window.electronAPI.runtime.getPdfJsConfig();
  }

  return pdfJsRuntimeConfigPromise;
};

export const getResolvedPdfJsRuntimeConfig = async (): Promise<PdfJsRuntimeConfig> => {
  const runtimeConfig = await getPdfJsRuntimeConfig();

  return {
    moduleUrl: resolvePdfJsAssetUrl(runtimeConfig.moduleUrl),
    workerUrl: resolvePdfJsAssetUrl(runtimeConfig.workerUrl),
    standardFontDataUrl: resolvePdfJsAssetUrl(runtimeConfig.standardFontDataUrl),
  };
};

export const resolvePdfJsAssetUrl = (
  resourceUrl: string,
  currentProtocol = window.location.protocol,
  currentOrigin = window.location.origin
) => {
  if (!resourceUrl.startsWith('file://') || !currentProtocol.startsWith('http')) {
    return resourceUrl;
  }

  const fileUrl = new URL(resourceUrl);
  const viteFsPath = fileUrl.pathname.replace(/^\/([A-Za-z]:\/)/, '$1').replace(/^\/+/, '');
  return `${currentOrigin}/@fs/${viteFsPath}`;
};

export const loadPdfJs = async (): Promise<PdfJsModule> => {
  const runtimeConfig = await getResolvedPdfJsRuntimeConfig();
  const moduleUrl = runtimeConfig.moduleUrl;
  const workerUrl = runtimeConfig.workerUrl;

  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import(/* @vite-ignore */ moduleUrl) as Promise<PdfJsModule>;
  }

  const pdfJsModule = await pdfJsModulePromise;

  if (pdfJsModule.GlobalWorkerOptions.workerSrc !== workerUrl) {
    pdfJsModule.GlobalWorkerOptions.workerSrc = workerUrl;
  }

  return pdfJsModule;
};
