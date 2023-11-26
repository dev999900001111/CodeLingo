# CodeLingo

## 概要

CodeLingoは、ソースコードのコメントを自動的に翻訳するCLIツールです。ChatGPTを利用した高精度な翻訳機能により、多言語対応の開発チームがソースコード内のコメントを簡単に理解し共有できます。

## 特徴

- **多言語翻訳**: 広範囲の言語に対応した翻訳機能。
- **ChatGPT駆動**: 最先端のAIによる精確な翻訳。
- **簡単なCLI操作**: コマンドラインから直感的に使用可能。
- **柔軟なファイル指定**: 個別のファイルまたはディレクトリを指定して翻訳。

## 使用方法

```bash
export OPENAI_API_KEY=[YOUR_OPENAI_API_KEY]
npm run build
node dist/app/cli.js # ヘルプを表示
node dist/app/cli.js --language [翻訳言語] --file-or-directory [ファイル/ディレクトリ] --output-dir [出力ディレクトリ]
```

## 貢献

貢献者の方々は、GitHubのIssueやPull Requestを通じてプロジェクトに貢献できます。新しい機能の提案やバグの報告など、あらゆる形の貢献を歓迎します。

## ライセンス

このプロジェクトは [MITライセンス](LICENSE) の下で公開されています。

## 著者

[dev999900001111](https://github.com/dev999900001111)
