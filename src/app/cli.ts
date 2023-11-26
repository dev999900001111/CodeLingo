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
    language: '言語',
    outputDirectory: '出力先ディレクトリ',
};
const messageEn = {
    usage: 'Usage',
    epilog: 'This is the end',
    version: 'Show version number',
    demandCommand: 'You need at least one command before moving on',
    example: `Translate all comments in the source code under the "./src/" directory into Japanese and output them to the "output" directory`,
    description: `Translate all comments in the source code under the specified file or directory into the specified language`,
    fileOrDirectory: 'File or directory',
    language: 'Language',
    outputDirectory: 'Output directory',
};
const message = messageJp;

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
    .option('language', { alias: 'l', describe: message.language, type: 'string', default: 'Japanese' })
    .option('file-or-directory', { alias: 'f', describe: message.fileOrDirectory, type: 'array', default: ['./src/'] })
    .option('output-dir', { alias: 'd', describe: message.outputDirectory, type: 'string', default: 'translated' })
    .recommendCommands()
    .completion() // completion でコマンド補完用のスクリプトが生成される。それを.bashrcとかに書いておくと補完が効く。
    .parseSync()
    ;
// console.log(argv);
main(argv.fileOrDirectory as string[], argv.language, argv.outputDir);
