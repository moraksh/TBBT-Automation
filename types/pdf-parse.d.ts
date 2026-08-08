declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    text: string;
    numpages?: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  };

  export default function pdf(buffer: Buffer): Promise<PdfParseResult>;
}
