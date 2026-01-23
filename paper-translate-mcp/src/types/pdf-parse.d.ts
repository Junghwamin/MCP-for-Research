declare module 'pdf-parse' {
  interface PDFInfo {
    Title?: string;
    Author?: string;
    CreationDate?: string;
    [key: string]: any;
  }

  interface PDFData {
    numpages: number;
    numrender: number;
    info: PDFInfo;
    metadata: any;
    version: string;
    text: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: any): Promise<PDFData>;

  export = pdfParse;
}
