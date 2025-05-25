
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { LLParse } from 'llparse';
import { dirname, resolve } from 'path';
import { llJson } from '../src/lljson';


const C_FILE = resolve(__dirname, '../build/c/lljson.c');
const HEADER_FILE = resolve(__dirname, '../build/lljson.h');




// TODO: (Vizonex) llparse enum names after being compiled so 
// that llhttp can compiled alongside it...


let llparse = new LLParse('lljson__internal');

const generated = llparse.build(new llJson(llparse).build(), {
  c: {
    header: 'lljson',
  },
  debug: process.env.LLJSON_DEBUG ? 'lljson__debug' : undefined,
  headerGuard: 'INCLUDE_JSON_ITSELF_H_',
});

mkdirSync(dirname(C_FILE), { recursive: true });
writeFileSync(HEADER_FILE, generated.header);
writeFileSync(C_FILE, generated.c);


