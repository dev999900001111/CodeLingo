#!/usr/bin/env node

// typescriptのデバッグ用にsource-map-supportを読み込む
import 'source-map-support/register.js'

import { fileURLToPath } from 'url';
import * as  fs from 'fs';
import * as  path from 'path';

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
// import inquirer from 'inquirer';
// import chalk from 'chalk';
// import ora from 'ora';


import { main } from './main.js';

const messageJp = {
    usage: '使い方',
    epilog: '以上',
    version: 'バージョン番号を表示する',
    demandCommand: 'コマンドを指定してください',
    example: `./src/ディレクトリ配下のソースコード全てを参照し、コメント部を日本語に翻訳したものをoutputディレクトリに出力する`,
    description: `指定されたファイルまたはディレクトリ配下のソースコード全てを参照し、コメント部を指定された言語に翻訳する`,
    fileOrDirectory: 'ファイルまたはディレクトリ',
    language: '翻訳先の言語。English/Japanese/Chinese/...',
    outputDirectory: '出力先ディレクトリ',
    specProgLang: '拡張子による自動判別を使わずに、変換対象のプログラミング言語の拡張子を指定する',
    forceCopy: '対応していない拡張子の場合に、ファイルをコピーするかどうか。trueの場合はコピーする。',
};
const messageEn = {
    usage: 'Usage',
    epilog: 'This is the end',
    version: 'Show version number',
    demandCommand: 'You need at least one command before moving on',
    example: `Translate all comments in the source code under the "./src/" directory into Japanese and output them to the "output" directory`,
    description: `Translate all comments in the source code under the specified file or directory into the specified language`,
    fileOrDirectory: 'File or directory',
    language: 'Language to translate to. English/Japanese/Chinese/...',
    outputDirectory: 'Output directory',
    specProgLang: 'Specify the extension of the programming language to be converted without using automatic determination by extension',
    forceCopy: 'Whether to copy the file if the extension is not supported. If true, copy the file.',
};

// 言語によってメッセージを変える
if (!process.env.LANG || process.env.LANG === 'C') {
    // console.log(Intl.DateTimeFormat().resolvedOptions().locale); // ユーザーのロケールを出力
    process.env.LANG = Intl.DateTimeFormat().resolvedOptions().locale.replace(/-/g, '_') + '.UTF-8';
} else {/* do nothing */ }
const message = (process.env.LANG || '').startsWith('ja_JP') ? messageJp : messageEn;

// package.jsonを読み込む
const file = fileURLToPath(import.meta.url);
const appDire = path.dirname(file);
const packageJson = JSON.parse(fs.readFileSync(path.join(appDire, `../../package.json`), 'utf8'));
const scriptName = Object.keys(packageJson.bin)[0];

const argv = yargs(hideBin(process.argv))
    .scriptName(scriptName)
    .usage(`${message.usage}: $0 <language> <fileOrDirectory> [options]`)
    .version(packageJson.version)
    .help()
    .wrap(null) // ヘルプの幅を指定する
    // .strict() // 引数の数が合わないとか知らないオプションとかでエラーにするかどうか
    .epilog(message.epilog) // ヘルプの最後に表示される
    .showHelpOnFail(true)
    // .demandCommand(1, message.demandCommand)
    // batch 用の設定 ------------------------------------------------------------------------------
    .example('$0 -l Japanese -f ./src/ -d="output"', message.example)
    .option('language', { alias: 'l', describe: message.language, type: 'string', demandOption: true })
    .option('file-or-directory', { alias: 'f', describe: message.fileOrDirectory, type: 'array', default: ['./src/'] })
    .option('output-dir', { alias: 'd', describe: message.outputDirectory, type: 'string', default: 'translated' })
    .option('specify-programming-language', { alias: 's', describe: message.specProgLang, type: 'string', default: '' })
    .option('force-copy', { alias: 'c', describe: message.forceCopy, type: 'boolean', default: false })
    .recommendCommands()
    .completion() // completion でコマンド補完用のスクリプトが生成される。それを.bashrcとかに書いておくと補完が効く。
    .parseSync()
    ;
// console.log(argv);
main(argv.language, argv.fileOrDirectory as string[], argv.outputDir, argv.specifyProgrammingLanguage, argv.forceCopy);
