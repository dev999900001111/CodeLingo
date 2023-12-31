# CodeLingo

## Overview

In the open-source world, source code written in various languages is shared. However, understanding becomes a significant challenge when comments are written in different languages. Additionally, when sharing your own code widely, it is necessary to write comments in English.

CodeLingo is a CLI tool developed to address this issue. It helps individual developers understand open-source code and provides the ability to translate comments into English for widespread sharing of their own code.

CodeLingo is a CLI tool that extracts only the comments from source code, translates them using ChatGPT, and replaces the original comments.

## Features

- **Multilingual Translation**: Translation capabilities for numerous programming languages.
- **Powered by ChatGPT**: Precise translations driven by cutting-edge AI.
- **Simple CLI Operations**: Intuitively usable from the command line.
- **Flexible File Specification**: Translate individual files or entire directories.
- **Rapid Syntax Parsing**: No delay in syntax parsing as it does not use AST.
- **Cache Function**: Cache translated comments to save consumption tokens.

## How to Use

```bash
export OPENAI_API_KEY=[YOUR_OPENAI_API_KEY]
npm run build
node dist/app/cli.js --help # Display help
node dist/app/cli.js --language [Translation Language (English/Japanese/Chinese...)] --file-or-directory [File/Directory] --output-dir [Output Directory]
```

When executed, the specified file or directory's comments will be translated, and the translated files will be output to the output directory.

In the translated-cache directory, translated comments are cached. If translated comments are already cached, the cache will be used.

To delete the translated comments from the cache, please remove the translated-cache directory.

## Supported Programming Languages

Files without extensions will not be translated as it determines based on file extensions.

- C (.c, .h)
- C++ (.cpp, .hpp)
- C# (.cs)
- CSS (.css, .scss, .sass, .less)
- Dart (.dart)
- Go (.go)
- HTML (.html, .htm)
- Haskell (.hs)
- Java (.java, .scala, .groovy)
- JavaScript (.js, .jsx)
- JSP (.jsp)
- Kotlin (.kt, .kts)
- Lisp (.lisp, .lsp, .cl, .clisp, .el)
- Lua (.lua)
- Perl (.pl, .pm, .t)
- PHP (.php)
- Python (.py, .pyc)
- Ruby (.rb)
- Rust (.rs)
- Shell (.sh, .bash, .csh, .zsh, .fish)
- Swift (.swift) # May not translate correctly if there are nested comments
- SQL (.sql)
- TypeScript (.ts, .tsx)

## Translation Languages

Utilizing ChatGPT (gpt-3.5-turbo) translation capabilities, it supports multiple languages, including English, Spanish, French, German, Portuguese, Italian, Dutch, Russian, Arabic, and Chinese.

The "Translation Language" specified in --language will be embedded and translated in the following prompt.

```markdown
Translate the comments into ${targetLanguage}. Please return the comments that are originally in ${targetLanguage} as is. Be careful not to change the presence of newline characters.
```

## Log Format

In the current version, the log is output in the following format. By sorting, you can match the comments before and after translation.

```log
Translate:[md5hash]:[req/res]:[stack count]:comment
```

*This format is provisional and may change in the future.

## Caution

Occasionally, the OpenAI API may stall. (*This is particularly noticeable when the number of targeted comments exceeds 100.) In such cases, terminate the process with Ctrl+C and execute it again.

When re-executing, the cache will be used, which can help reduce stalling.

## Contributions

Contributors can contribute to the project through GitHub Issues and Pull Requests. All forms of contributions, including new feature suggestions and bug reports, are welcome.

## License

This project is released under the [MIT License](LICENSE).

## Author

[dev999900001111](https://github.com/dev999900001111)
