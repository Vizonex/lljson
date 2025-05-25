

export type IntDict = Record<string, number>;

// TODO: Remove anything that isn't being used to compile lljson



export type CharList = (string | number)[];

export const ERROR : IntDict = {
    INVALID_KEY: 0,
    INVALID_VALUE : 1,

    CALLBACK_ERROR : 2,
    // Data was malformed at the start before even getting anywhere
    MALFORMED_DATA: 3,
    // TOO Many Recursions...
    RECUSRION_ERROR:4,
    CONTAINER_ERROR:5,
    INAVLID_INTEGER:6
};

/** Assists in handling recustions of known containter types 
 * Otherwise 2 tells the parser to stop parsing and end...
*/
export const CONTAINER_TYPE: IntDict = {
    ARRAY: 0,
    OBJECT: 1,
    END_RECURSION:2,
    CONTAINER_ERROR:3
}

export const NUMBER_TYPE : IntDict = {
    NUM_DEFAULT: 1 << 0,
    NUM_NEGTAIVE: 1 << 1,
    NUM_FLOAT: 1 << 2,
    NUM_EXP: 1 << 3
};

export const NON_ZERO_NUMBERS:CharList = ['1','2','3','4','5','6','7','8','9'];

export const NUMBERS:CharList = ['0','1','2','3','4','5','6','7','8','9'];

export const WHITESPACE_CHARS:CharList = ['\r', '\n', '\t', ' ', '\s'];

export const LIMIT = (2**53)+1;

export const NUM_MAP = {
    0: 0, 1: 1, 2: 2, 3: 3, 4: 4,
    5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
};

export const HEX_MAP = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4,
  5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
  A: 0XA, B: 0XB, C: 0XC, D: 0XD, E: 0XE, F: 0XF,
  a: 0xa, b: 0xb, c: 0xc, d: 0xd, e: 0xe, f: 0xf,
};

export default {
    HEX_MAP,

}