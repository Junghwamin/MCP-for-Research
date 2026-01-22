declare module 'docx' {
  export class Document {
    constructor(options: any);
  }

  export class Packer {
    static toBuffer(doc: Document): Promise<Buffer>;
  }

  export class Paragraph {
    constructor(options: any);
  }

  export class TextRun {
    constructor(options: any);
  }

  export class ImageRun {
    constructor(options: any);
  }

  export class Table {
    constructor(options: any);
  }

  export class TableRow {
    constructor(options: any);
  }

  export class TableCell {
    constructor(options: any);
  }

  export const HeadingLevel: {
    HEADING_1: string;
    HEADING_2: string;
    HEADING_3: string;
    HEADING_4: string;
    HEADING_5: string;
    HEADING_6: string;
    TITLE: string;
  };

  export const AlignmentType: {
    LEFT: string;
    CENTER: string;
    RIGHT: string;
    JUSTIFIED: string;
  };

  export const WidthType: {
    AUTO: string;
    DXA: string;
    NIL: string;
    PERCENTAGE: string;
  };

  export function convertInchesToTwip(inches: number): number;
}
