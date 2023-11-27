# CodeLingo

## 概要

CodeLingoは、ソースコードのコメントのみを抜き出して翻訳するCLIツールです。

ChatGPTの高精度な翻訳機能を活用し、多言語開発チームにおけるソースコードコメントの理解と共有を容易にします。

## 特徴

- **多言語翻訳**: 多数のプログラミング言語に対応した翻訳機能。
- **ChatGPT駆動**: 最先端のAIによる精確な翻訳。
- **簡単なCLI操作**: コマンドラインから直感的に使用可能。
- **柔軟なファイル指定**: 個別のファイルまたはディレクトリを指定して翻訳。
- **高速な構文解析**: ASTを利用しないため、構文解析に時間がかかりません。

## 使用方法

```bash
export OPENAI_API_KEY=[YOUR_OPENAI_API_KEY]
npm run build
node dist/app/cli.js --help # ヘルプを表示
node dist/app/cli.js --language [翻訳言語(English/Japanese/Chinese...)] --file-or-directory [ファイル/ディレクトリ] --output-dir [出力ディレクトリ]
```

## 翻訳言語

ChatGPT（gpt-3.5-turbo）の翻訳機能を使用するので、英語、スペイン語、フランス語、ドイツ語、ポルトガル語、イタリア語、オランダ語、ロシア語、アラビア語、中国語を含む複数の言語に対応しています。

--languageに指定した"翻訳言語"は、以下のプロンプトの${targetLanguage}に埋め込まれて翻訳されます。

```markdown
Translate the comments into ${targetLanguage}. Please return the comments that are originally in ${targetLanguage} as is. Be careful not to change the presence of newline characters.
```

## 対応プログラミング言語

拡張子によって判別しているため、拡張子がないファイルは翻訳されません。

- C (.c, .h)
- C++ (.cpp, .hpp)
- C# (.cs)
- CSS (.css, .scss, .sass, .less)
- Dart (.dart)
- Go (.go)
- HTML (.html, .htm)
- haskell (.hs)
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
- Swift (.swift) # コメントのネストがある場合は正しく翻訳されない
- SQL (.sql)
- TypeScript (.ts, .tsx)

## 貢献

貢献者の方々は、GitHubのIssueやPull Requestを通じてプロジェクトに貢献できます。新しい機能の提案やバグの報告など、あらゆる形の貢献を歓迎します。

## ライセンス

このプロジェクトは [MITライセンス](LICENSE) の下で公開されています。

## 著者

[dev999900001111](https://github.com/dev999900001111)
