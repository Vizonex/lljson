import assert from 'assert';
import { type LLParse, source } from 'llparse';
import { ERROR, NUMBER_TYPE, NON_ZERO_NUMBERS, NUMBERS, HEX_MAP, CONTAINER_TYPE, WHITESPACE_CHARS, LIMIT, NUM_MAP } from './constants';


import Match = source.node.Match;
import CodeMatch = source.code.Match;
import Node = source.node.Node;
import Code = source.code.Code;
import Span = source.Span;




/// Special Code Map that can detect Key Errors and attempt 
// to tell us where something may have gone wrong...
// class CodeMap<T extends Code> {

//     protected matches = new Map<string, T>;

//     /// tag is Used for identifying what variable were referring to
//     // if we see an error or a certain kind of object doesn't exist...
//     constructor(readonly tag:string){}

//     public set(name:string, value: T){
//         this.matches.set(name, value)
//     }

//     public get(name:string | T) : T {
//         if (name instanceof Code){
//             return name;
//         }
//         assert(this.matches.has(name), `"${this.tag}" Contains an unknown code named "${name}"`);
//         return this.matches.get(name) as unknown as T;
//     }
// }


// In order to make things a bit easier it was decided that 
// a Baseclass of our own might do the trick...

class JsonNode {
    readonly name: string;
    constructor (readonly llparse:LLParse, readonly prefix:string){
        this.name = `lljson_${prefix}`;
    }



    // Class Calls only...

    protected cb_name(name:string): string {
        return `${this.name}__on_${name}`;
    }
    /// Makes Writing matches and callbacknames less annoying, more lazy.
    protected cb_match(name:string) : CodeMatch {
        return this.llparse.code.match(this.cb_name(name));
    }

    protected node(name:string) : Match {
        // Using the prefix name should be enough to organize our states in the C code...
        return this.llparse.node(`${this.prefix}_${name}`);
    }

    public match(match:CodeMatch, name:string, next: Node) : Node {
        const p = this.llparse;
        
        return p.invoke(match, {0:next, 1: p.pause(4, `paused by \`${name}\``).otherwise(next)},
            p.error(2, `\`${name}\` callback error`)
        );
    }
}



interface IStringCallbackMap {
    onStart: CodeMatch,
    onEnd: CodeMatch
}

class JsonString extends JsonNode {
    private readonly span: Span
    private readonly callback: IStringCallbackMap;

    // I have a feeling that calling any of these nodes twice raises an error...
    constructor(readonly llparse:LLParse, suffix?:string){
        if (suffix !== undefined) {
            super(llparse, `string_${suffix}`);
        } else {
            super(llparse, `string`);
        }

        this.callback = {
            onStart: this.cb_match("start"),
            onEnd : this.cb_match("end")
        }

        const p = this.llparse;

        this.span = p.span(p.code.span(this.cb_name("value")));
    }

    
    public hex_match(name:string, next:Node,  chars:number): Node{
        const p = this.llparse;
        return this.node(name).transform(
            p.transform.toLower()
        ).match(
            ['1', '2','3', '4','5', '6', '7', '8', '9', '0', 'a', 'b', 'c', 'd', 'e', 'f'],
            next
        ).otherwise(
            p.error(2, `String Hexidecimals should have 4 values not ${chars}`)
        );
    }
    
    /// When string quote is found, 
    // parser Runs Through these states
    public build(after:Node): Match {
        const skip_to_start = this.node("skip_to_start");
        const skip_to_end = this.node("skip_to_end");

        const value = this.node("value");
        const escape_char = this.node("escape_char");

        const cb = this.callback;
        const p = this.llparse;

        

        // We peeked our first quote earlier
        const start = skip_to_start.skipTo(this.span.start(
            this.match(cb.onStart, "on_start", value)
        ));



        // Resume after node after finding the end quote...
        skip_to_end.skipTo(after);

        // NOTE: Hex values should be used after \u and there should be 4 of them
        const hex_match = this.hex_match(
            "hex_match", this.hex_match(
            "hex_match_1", this.hex_match( 
            "hex_match_2", this.hex_match(
            "hex_match_3", value, 3), 2), 1), 0);
        



        escape_char
            .match(
                [
                    "\"", 
                    '\\', 
                    '/', 
                    'b',
                    'f',
                    'n',
                    'r',
                    't',
                ], value
            )
            // We need to find 4 valid hex values if we made it this far...
            .match('u', hex_match)
            .otherwise(
                p.error(2, "Invalid escape character")
            );

        value
            .match('\\', escape_char)
            .peek(
                '\"', 
                this.span.end(
                    this.match(cb.onEnd, "on_end", skip_to_end)
                )
            )
            // Loop around because any codepoint works except 
            // " or \ or control characters...
            .skipTo(value);
        return start;
    }
}


//  NOTE RFC-8259: A JSON number such as 1E400
//  or 3.141592653589793238462643383279 may indicate potential
//  interoperability problems, since it suggests that the software that
//  created it expects receiving software to have greater capabilities
//  for numeric magnitude and precision than is widely available.

const MULADD_LIMIT = (2**53); 


// Portions of this code borrow parts of llhttp so we can save time...

interface IMulOptions {
  readonly base: number;
  readonly max?: number;
  readonly signed: boolean;
}

interface IMulTargets {
  readonly overflow: Node;
  readonly success: Node;
}

// Properties required are 
// Values: integer, fract, exp
// Flags: integer_flag

class JsonNumber extends JsonNode {
    

    constructor(
        readonly llparse:LLParse, 
        readonly onNumber:CodeMatch,
        suffix?:string){
        if (suffix !== undefined) {
            super(llparse, `number_${suffix}`);
        } else {
            super(llparse, `number`);
        }
        
    }

    private mulAdd(field: string, targets: IMulTargets, signed:boolean | undefined): Node {
        const p = this.llparse;

        return p.invoke(p.code.mulAdd(field, { base: 10, max:MULADD_LIMIT , signed}), {
            1: targets.overflow,
        }, targets.success);
    } 


    public resetValue(property:string, next?:Node) : Node {
        const p = this.llparse;
        let res = p.invoke(p.code.update(property, 0));
        if (next !== undefined){
            return res.otherwise(next);
        }
        return res;
    }

    public update(property:string, value:number, next?:Node) : Node {
        const p = this.llparse;
        let res = p.invoke(p.code.update(property, value));
        if (next !== undefined){
            return res.otherwise(next);
        }
        return res;
    }

    public build(after: Node, neg:boolean){
        const p = this.llparse;
        
        const integer = this.node("integer");
        const exponent = this.node("exponent");
        const fraction = this.node("fraction");
        
        // Ensure that Numbers are reset after callback is over...
        const end = p.invoke(this.onNumber, 
            {0: this.resetValue("negtaive",
                this.resetValue("integer", 
                this.resetValue("fraction", 
                this.resetValue("exponent", after))))
        }).otherwise(p.error(1, "Callback Error in User Number Callback"));

        // Numbers are parsed for the user instead of buffering
        // In order to ensure that the numbers obey RFC 8259
        integer
            .select(
                NUM_MAP, 
                this.mulAdd(
                    "integer", 
                    {
                        success:integer,
                        overflow:p.error(2, "Integer Overflow")
                    }, 
                    false
                )
            )
            .match('.', fraction)
            .match(['e', 'E'], exponent)
            .otherwise(end);
        
        fraction
            .select(
                NUM_MAP, 
                this.mulAdd(
                    "fraction", 
                    {
                        success:fraction,
                        overflow:p.error(2, "Fraction Overflow")
                    }, 
                    false
                )
            )
            .match(['e', 'E'], exponent)
            .otherwise(end);

        exponent
            .select(
                NUM_MAP,
                this.mulAdd(
                    "exponent",
                    {
                        success:exponent,
                        overflow:p.error(2, "Exponent Overflow")
                    },
                    // Try taking in signed values first if seen...
                    true
                )
            )
            .otherwise(end);
            
        // update as a negative value if negative value is seen...
        return (neg) ? this.update("negative", 1, integer): integer;
    }
}



interface IValueRoute {
    /// Object (1)
    onStartObject:Node,
    /// Array (0)
    onStartArray:Node,
    /// declares parsing is over (-1)...
    onEnd:Node
}



enum ContainerType {
    ARRAY,
    OBJECT
}

interface IValueNode {
    start:Match,
    // Next can also be start...
    next:Match
    bool:source.code.Value,
    null:source.code.Code,
    number:source.code.Code,
    // Not custom but it is hardcoded.
    setContainer:source.code.Value
}

/** Contains Either Objects or Arrays that can be 
 * dynamically parsed or even infinately */
class JsonValue extends JsonNode {
    constructor(readonly llparse:LLParse){
        super(llparse, "value");
    }

    public build(value:IValueNode, route:IValueRoute, prefix:string){
        const p = this.llparse;

        let string_value = new JsonString(p, `value_${prefix}`);
        let neg_number_value = new JsonNumber(p, value.number, `negative_${prefix}`);
        let positive_number_value = new JsonNumber(p, value.number, prefix);

        // SEE: https://www.json.org/img/value.png 
        
        return value.start
            // White Space
            .match([' ', '\t', '\n', '\r'], value.start)
            // Boolean (true, false)
            .select(
                {
                    "false": 0,
                    "true": 1,
                }, 
                p.invoke(
                    value.bool, 
                    {0: value.next}
                ).otherwise(p.error(2, `User Callback Error on boolean value in ${prefix}`))
            )
            // Null
            .match(
                "null",
                p.invoke(
                    value.null, 
                    {0: value.next}
                ).otherwise(p.error(2, `User Callback Error on NULL value in ${prefix}`))
            )
            // string
            .peek(
                '"', string_value.build(value.next)
            )
            // Integers Signed
            .match('-', neg_number_value.build(value.next, true)
            )
            // Integers Unsigned
            .peek(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], 
                positive_number_value.build(value.next, false)
            )
            // object / array
            .select(
                {
                    '{': 1, 
                    '[': 0
                }, 
                p.invoke(value.setContainer, 
                    {
                        0: route.onStartArray,
                        1: route.onStartObject
                    }
                    // Because the setContainer is hardcoded The only conclusion is that 
                    // the user Went further than the recursion containers that are being carried.
                    ).otherwise(p.error(3, "Recursion Limit Was Reached"))
                )
            .otherwise(
                p.error(1, `Invalid Json Value inside of an ${prefix}`)
            );
    }

    
}

interface IArrayNode {
    start:Match,
    bool:source.code.Value,
    null:source.code.Code,
    number:source.code.Code,
    // Not custom but it is hardcoded.
    setContainer:source.code.Value,
    loadContainer:source.code.Match
}

class JsonContainer extends JsonNode {
    protected last_container_value(cb:CodeMatch, route:IValueRoute) : Node {
        const p = this.llparse;
        return p.invoke(cb, {
            0: route.onStartArray,
            1: route.onStartObject,
            2: route.onEnd
        }).otherwise(p.error(1, "Invalid Container Passed through the Recursion Array"));
    }
}

class JsonArray extends JsonContainer {
    constructor(readonly llparse:LLParse){
        super(llparse, "array");
    }

    /// A Custom Callback that pulls out an array to figure out 
    /// What container we left off on...
    

    public build(value:IArrayNode, route:IValueRoute): Node {
        const p = this.llparse;
        let array_value = new JsonValue(p);
        let comma_or_closure =  this.node("comma_or_closure");
        
        const on_array_start = this.match(this.cb_match("array_start"), "on_array_start", value.start);
        const on_array_end = this.match(this.cb_match("array_end"), "on_array_end", 
            this.last_container_value(value.loadContainer, route)
        );

        array_value.build({
            // Handle extra closure here if any are seen...
            start: value.start.match("]", on_array_end),
            next: comma_or_closure,
            bool: value.bool,
            null: value.null,
            number: value.number,
            setContainer: value.setContainer}, 
            route,
            "array"
        );

        comma_or_closure
            .match([' ', '\t', '\n', '\r'], value.start)
            .match(',', value.start)
            .match("]", on_array_end)
            .otherwise(p.error(1, "Invalid Array Value or Closure"));

        return on_array_start;
    }
}

interface IObjectNode {
    start:Match,
    bool:source.code.Value,
    null:source.code.Code,
    number:source.code.Code,
    // Not custom but it is hardcoded.
    setContainer:source.code.Value,
    loadContainer:source.code.Match
}

class JsonObject extends JsonContainer {
    constructor(readonly llparse:LLParse){
        super(llparse, "object");
    }
    public build(value:IObjectNode, route:IValueRoute){
        const p = this.llparse;

        const on_end = this.match(this.cb_match("object_end"), "on_object_end", 
            this.last_container_value(value.loadContainer, route)
        );
        const start_or_closure = this.node("start_or_closure");
        const on_start = this.match(this.cb_match("object_start"), "on_object_start", start_or_closure);

        const closure_error = p.error(1, "Invalid Object Value Or Closure");

        let object_key = new JsonString(p, "object_key");        
        let object_value = new JsonValue(p);

        let find_value_colon = this.node("find_value_colon")
        let comma_or_closure =  this.node("comma_or_closure");
        
        start_or_closure
            .match([' ', '\t', '\n', '\r'], start_or_closure)
            .match("\"", object_key.build(find_value_colon))
            .match("}", on_end)
            .otherwise(closure_error);
        

        find_value_colon
            .match([' ', '\t', '\n', '\r'], find_value_colon)
            .match(':', object_value.build(
                {
                    'start':value.start,
                    'bool':value.bool,
                    'next':comma_or_closure,
                    'null':value.null,
                    'number':value.number,
                    'setContainer':value.setContainer
                },
                route, 
                'object_value'
            ))
            .otherwise(p.error(1, "Invalid middle delimiter")); 

        
        comma_or_closure
            .match([' ', '\t', '\n', '\r'], comma_or_closure)
            .match("}", on_end)
            .otherwise(closure_error);

        return on_start;
    }
}



export class llJson {
    readonly object: IObjectNode;
    readonly array: IArrayNode;


    public match(match:CodeMatch, name:string, next: Node) : Node {
        const p = this.llparse;
        
        return p.invoke(match, {0:next, 1: p.pause(4, `paused by \`${name}\``).otherwise(next)},
            p.error(2, `\`${name}\` callback error`)
        );
    }

    constructor(readonly llparse:LLParse){
        const p = this.llparse;

        // prevent parser from recursing over repeated elements

        this.object = { 
            'start':p.node("lljson__on_object_start"),
            'bool': p.code.value('lljson__on_boolean'),
            'loadContainer':p.code.match('lljson__load_recursion_container'),
            'null': p.code.match('lljson__on_null'),
            'number':p.code.match('lljson__on_number'),
            'setContainer':p.code.value('lljson__set_recursion_container')
        }
        const object = this.object;

        this.array = {
            'start': p.node("lljson__on_array_start"),
            'bool': object['bool'],
            'loadContainer': object['loadContainer'],
            'null': object['null'],
            'number': object['number'],
            'setContainer': object['setContainer']
        }

        
    }

    public build(): Node {
        const p = this.llparse;

        p.property('ptr', "settings");
        p.property('i8', "negtaive");
        p.property('i64', "integer");
        p.property('i64', "fraction");
        p.property('i32', "exponent");

        // char* recursion_array 
        p.property('ptr', "recursion_array");
        // 32 bit recursion cursor
        p.property('i32', "recursion_cursor");
        // Memory allocated for supporting recursions...
        p.property("i32", "recursion_limit");

        const start = p.node("lljson__start");
        const routes: IValueRoute = {
            'onEnd': this.match(p.code.match('lljson__on_end'), 'on_end', start),
            'onStartArray':this.array.start,
            'onStartObject':this.object.start
        };

        const object = new JsonObject(p);
        const array = new JsonArray(p);


        start
            .select(
                {
                    '{': 1, 
                    '[': 0
                }, 
                p.invoke(this.object.setContainer, 
                    {
                    0: object.build(this.object, routes),
                    1: array.build(this.array, routes)
                }
                // Because the setContainer is hardcoded The only conclusion is that 
                // the user Went further than the recursion containers that are being carried.
                ).otherwise(p.error(3, "Recursion Limit Was Reached"))
            )
            .match([' ', '\t', '\n', '\r'], start)
            .otherwise(p.error(1, "Invalid Start Delimiter"));
        

        return start;
    }   

}



