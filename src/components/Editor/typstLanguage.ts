import type { languages } from "monaco-editor";

export const typstMonarch: languages.IMonarchLanguage = {
	defaultToken: "",
	tokenPostfix: ".typ",

	keywords: [
		"set",
		"let",
		"show",
		"if",
		"else",
		"for",
		"while",
		"import",
		"include",
		"return",
		"as",
		"in",
		"and",
		"or",
		"not",
		"break",
		"continue",
		"context",
		"from",
	],

	constants: ["none", "auto", "false", "true"],

	types: [
		"arguments",
		"array",
		"bool",
		"bytes",
		"content",
		"datetime",
		"decimal",
		"dictionary",
		"duration",
		"float",
		"function",
		"int",
		"label",
		"module",
		"regex",
		"selector",
		"str",
		"type",
		"version",
		"math",
		"calc",
		"std",
		"sys",
		"sym",
		"emoji",
	],

	functions: [
		// Model
		"bibliography",
		"cite",
		"document",
		"emph",
		"enum",
		"figure",
		"footnote",
		"heading",
		"link",
		"list",
		"numbering",
		"outline",
		"par",
		"parbreak",
		"quote",
		"strong",
		"table",
		"terms",
		// Text
		"lower",
		"upper",
		"smallcaps",
		"raw",
		"text",
		"hyphenate",
		"linebreak",
		"overline",
		"smartquote",
		"strike",
		"underline",
		"highlight",
		"display",
		"today",
		// Layout
		"align",
		"block",
		"box",
		"colbreak",
		"columns",
		"grid",
		"h",
		"hide",
		"move",
		"pad",
		"page",
		"pagebreak",
		"place",
		"repeat",
		"rotate",
		"scale",
		"stack",
		"v",
		// Visualize
		"circle",
		"color",
		"ellipse",
		"gradient",
		"image",
		"line",
		"path",
		"pattern",
		"polygon",
		"rect",
		"square",
		// Math
		"accent",
		"binom",
		"cancel",
		"cases",
		"class",
		"frac",
		"limits",
		"lr",
		"mat",
		"op",
		"overbrace",
		"root",
		"scripts",
		"sqrt",
		"stretch",
		"underbrace",
		"vec",
		// Introspection & Data
		"counter",
		"here",
		"locate",
		"query",
		"state",
		"cbor",
		"csv",
		"json",
		"read",
		"toml",
		"xml",
		"yaml",
		// Foundation
		"assert",
		"eval",
		"panic",
		"plugin",
		"repr",
		"where",
	],

	operators: [
		"=",
		"=>",
		"+",
		"-",
		"*",
		"/",
		"==",
		"!=",
		"<",
		"<=",
		">",
		">=",
		"&&",
		"||",
		"!",
		"+=",
		"-=",
		"*=",
		"/=",
		"..",
		".",
	],

	tokenizer: {
		root: [
			// Headings
			[/^=.*$/, "heading"],

			// Comments
			[/\/\/.*/, "comment"],
			[/\/\*/, "comment", "@comment"],

			// Strings
			[/"/, "string", "@string"],

			// Hash-prefixed things (Keywords, Functions, etc.)
			[
				/(#)([a-zA-Z_]\w*)/,
				[
					"keyword",
					{
						cases: {
							"@keywords": "keyword",
							"@constants": "constant",
							"@types": "type",
							"@functions": "function",
							"@default": "variable",
						},
					},
				],
			],

			// Single #
			[/#/, "keyword"],

			// Function calls (identifier followed by '(')
			[
				/[a-zA-Z_]\w*(?=\()/,
				{
					cases: {
						"@functions": "function",
						"@types": "type",
						"@default": "function",
					},
				},
			],

			// Named parameters or property access in dicts
			[/[a-zA-Z_]\w*(?=:)/, "variable.parameter"],

			// Built-in types and symbols
			[
				/[a-zA-Z_]\w*/,
				{
					cases: {
						"@keywords": "keyword",
						"@constants": "constant",
						"@types": "type",
						"@functions": "function",
						"@default": "identifier",
					},
				},
			],

			// Markup markers
			[/^\s*[-+*]\s/, "list"],
			[/~/, "delimiter"],
			[/--|---|\\|\.\.\./, "delimiter"],

			// Numbers
			[/\d+(\.\d+)?(pt|mm|cm|in|%)?/, "number"],

			// Labels and Refs
			[/<[^>]+>/, "tag"],
			[/@[a-zA-Z0-9_-]+/, "tag"],

			// Brackets & Operators
			[/[{}()[\]]/, "delimiter"],
			[
				/[+\-*/=<>!]=?|&&|\|\||=>|\.\./,
				{
					cases: {
						"@operators": "operator",
						"@default": "operator",
					},
				},
			],
			[/[.:,;]/, "delimiter"],
		],

		comment: [
			[/[^/*]+/, "comment"],
			[/\*\//, "comment", "@pop"],
			[/[/*]/, "comment"],
		],

		string: [
			[/[^\\"]+/, "string"],
			[/\\./, "string.escape"],
			[/"/, "string", "@pop"],
		],
	},
};
