import OpenAI from 'openai';
import { APIPromise, RequestOptions } from 'openai/core';
import { ChatCompletion } from 'openai/resources';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
    timeout: 60000,
});

// 翻訳済みの文字列をキャッシュするためのオブジェクト
const translateMap: { [key: string]: string } = {};

// 言語ごとの文字、文字列括弧とコメントの開始文字列と終了文字列のセット
const quoteSet: { [key: string]: string[][][] } = {
    java: [
        [['"', '"'], ["'", "'"]],
        [['/*', '*/'], ['//', '\n']], //  ['{-', '-}'], ['--', '\n'], ['=begin', '=end'], ['#', '\n'], ['--[[', ']]'], ['--', '\n'], ['#|', '|#'], [';', '\n']
    ],
    js: [
        [['"', '"'], ["'", "'"], ['`', '`']],
        [['/*', '*/'], ['//', '\n']],
    ],
    html: [
        [],
        [['<!--', '-->']],
    ],
    css: [
        [['"', '"'], ["'", "'"]],
        [['/*', '*/']],
    ],
    py: [
        [['"', '"'], ["'", "'"]],
        [['"""', '"""'], ['\'\'\'', '\'\'\''], ['#', '\n']],
    ],
    sh: [
        [['"', '"'], ["'", "'"]],
        [['#', '\n']],
    ],
    sql: [
        [['"', '"'], ["'", "'"]],
        [['/*', '*/'], ['--', '\n']],
    ],
    rb: [
        [['"', '"'], ["'", "'"]],
        [['=begin', '=end'], ['#', '\n']],
    ],
    php: [
        [['"', '"'], ["'", "'"]],
        [['/*', '*/'], ['//', '\n'], ['#', '\n']],
    ],
    jsp: [
        [],
        [['<%', '%>']],
    ],
    lua: [
        [['"', '"'], ["'", "'"], ['[[', ']]']],
        [['--[[', ']]'], ['--', '\n']],
    ],
    pl: [
        [['"', '"'], ["'", "'"]],
        [['=pod', '=cut'], ['#', '\n']],
    ],
    hs: [
        [['"', '"'], ["'", "'"]],
        [['{-', '-}'], ['--', '\n']],
    ],
    lisp: [
        [['"', '"'], ["'", "'"]],
        [['#|', '|#'], [';', '\n']],
    ],
};
quoteSet['c'] = quoteSet['java'];
quoteSet['cpp'] = quoteSet['java'];
quoteSet['csh'] = quoteSet['java'];
quoteSet['h'] = quoteSet['java'];
quoteSet['hpp'] = quoteSet['java'];
quoteSet['cs'] = quoteSet['java'];
quoteSet['dart'] = quoteSet['java'];
quoteSet['scala'] = quoteSet['java'];
quoteSet['scss'] = quoteSet['java'];
quoteSet['sass'] = quoteSet['java'];
quoteSet['less'] = quoteSet['java'];
quoteSet['go'] = quoteSet['java'];
quoteSet['swift'] = quoteSet['java']; // ネストができないので、コメントのネストがある場合はエラーになる。
quoteSet['kt'] = quoteSet['java'];
quoteSet['kts'] = quoteSet['java'];
quoteSet['rs'] = quoteSet['java'];
quoteSet['ts'] = quoteSet['js'];
quoteSet['tsx'] = quoteSet['js'];
quoteSet['jsx'] = quoteSet['js'];
quoteSet['htm'] = quoteSet['html'];
quoteSet['pm'] = quoteSet['pl'];
quoteSet['t'] = quoteSet['pl'];
quoteSet['pyc'] = quoteSet['py'];
quoteSet['cl'] = quoteSet['lisp'];
quoteSet['clisp'] = quoteSet['lisp'];
quoteSet['el'] = quoteSet['lisp'];
quoteSet['lsp'] = quoteSet['lisp'];
quoteSet['plm'] = quoteSet['pl'];
quoteSet['bash'] = quoteSet['sh'];
quoteSet['zsh'] = quoteSet['sh'];
quoteSet['fish'] = quoteSet['sh'];

async function analyzeSourceFile(
    fileName: string,
    language: string,
    outputFileName?: string,
    specifyProgrammingLanguage?: string,
    forceCopy?: boolean,
): Promise<string | void> {

    // ファイルが存在するかどうかをチェックする。
    if (!fs.existsSync(fileName)) {
        console.error(`File not found: ${fileName}`);
        return;
    } else if (fs.statSync(fileName).isDirectory()) {
        console.error(`File is directory: ${fileName}`);
        return;
    } else {/* 何もしない */ }

    // 出力先のディレクトリが存在するかどうかをチェックする。
    if (outputFileName) {
        if (fs.existsSync(path.dirname(outputFileName))) {
            // ディレクトリが存在する場合は何もしない。
        } else {
            // ディレクトリが存在しない場合は作成する。
            fs.mkdirSync(path.dirname(outputFileName), { recursive: true });
        }
    } else {/* 何もしない */ }

    // 拡張子を取得する。
    const ext = specifyProgrammingLanguage || (fileName.split('.').pop() || '').toLowerCase();
    if (!quoteSet[ext]) {
        // 対応していない拡張子の場合、かつforceCopyがtrueの場合は、ファイルコピーだけする。
        if (forceCopy && outputFileName) {
            const buffer = await fs.promises.readFile(fileName);
            await fs.promises.writeFile(outputFileName, buffer);
            console.log(`Not supported file extension:[${ext}] so Copied ${fileName} to ${outputFileName}`);
        } else {
            console.error(`Not supported file extension:[${ext}] ${fileName}`);
        }
        return;
    }

    const fileBuffer = await fs.promises.readFile(fileName, 'utf8');
    return analyzeSourceCode(fileBuffer, ext, language)
        .then((result) => {
            if (outputFileName) {
                fs.promises.writeFile(outputFileName, result);
                console.log(`Translated ${fileName} to ${outputFileName}`);
                return result;
            } else {
                console.log(result);
            }
        });
}
let counter = 0;
/**
 * ソースコードを解析して、コメントを英語に翻訳する。
 * @param baseString ソースコード
 * @param ext 拡張子
 * @param targetLanguage 翻訳先の言語
 */
async function analyzeSourceCode(baseString: string, ext: string, targetLanguage: string): Promise<string> {

    // 文字、文字列括弧の開始文字列と終了文字列のセット
    const literalQuote: string[][] = quoteSet[ext][0];
    // コメントの開始文字列と終了文字列のセット
    const commentQuote: string[][] = quoteSet[ext][1];

    // 開始文字列と終了文字列のセットを結合してソートする。
    const checkerList = checkerSorter([literalQuote, commentQuote]);
    // console.log(`checkerList:${JSON.stringify(checkerList)}`);

    // proxy設定判定用オブジェクト
    const proxyObj: { [key: string]: string | undefined } = {
        httpProxy: process.env['http_proxy'] as string || undefined,
        httpsProxy: process.env['https_proxy'] as string || undefined,
    };

    // OpenAIのオプション設定
    const options: RequestOptions = {};
    // プロキシが設定されていたらhttAgentを設定する。
    if (Object.keys(proxyObj).filter(key => proxyObj[key]).length > 0) {
        options.httpAgent = new HttpsProxyAgent(proxyObj.httpsProxy || proxyObj.httpProxy || '');
    } else {/* 何もしない */ }

    let hitChecker: Checker | null = null;
    let startIndex = -1;
    const stringList: { promise: Promise<string>, checker: Checker | null, cached: boolean }[] = [];
    for (let idx = 0; idx < baseString.length; idx++) {
        if (hitChecker) {
            // すでにヒットしている場合
            // 終了文字列があるかどうかを判定する。
            const end = baseString.substring(idx, idx + hitChecker.bytesSet[1].length);
            if (end === hitChecker.bytesSet[1]) {
                if (hitChecker.iKwType === 1) {
                    const translateTarget = baseString.substring(startIndex, idx + hitChecker.bytesSet[1].length);
                    if (translateTarget in translateMap) {
                        stringList.push({ promise: Promise.resolve(translateMap[translateTarget]), checker: hitChecker, cached: true });
                    } else {
                        // md5でハッシュ値を計算する。
                        const argsHash = crypto.createHash('MD5').update(translateTarget).digest('hex');
                        console.log(`Translate:${argsHash}:req:${counter}:${translateTarget.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}`);
                        counter++;
                        // コメントの場合は翻訳する。
                        stringList.push({
                            promise: (openai.chat.completions.create({
                                model: 'gpt-3.5-turbo',
                                temperature: 0.0,
                                messages: [
                                    { role: 'system', content: `Translate the comments into ${targetLanguage}.\n- Please return the comments that are originally in ${targetLanguage} as is.\n- If you believe it is the source code of a program, please return it as is.\n- Be careful not to change the presence of newline characters.` },
                                    { role: 'user', content: translateTarget },
                                ],
                            }, options) as APIPromise<ChatCompletion>)
                                .withResponse()
                                .then(response => {
                                    counter--;
                                    // console.log(`counter: ${counter}`);
                                    const result = response.data.choices[0].message.content || '';
                                    console.log(`Translate:${argsHash}:res:${counter}:${result.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}`);
                                    translateMap[translateTarget] = result;
                                    return result;
                                }),
                            checker: hitChecker,
                            cached: false,
                        });
                    }
                } else {
                    // リテラルの場合はそのまま返す。
                    stringList.push({ promise: Promise.resolve(baseString.substring(startIndex, idx + hitChecker.bytesSet[1].length)), checker: null, cached: false });
                }
                idx = idx + hitChecker.bytesSet[1].length - 1;

                hitChecker = null;
            } else {
            }
        } else {
            // ヒットしていない場合
            // 開始文字列があるかどうかを判定する。
            for (const checker of checkerList) {
                const start = baseString.substring(idx, idx + checker.bytesSet[0].length);
                if (start === checker.bytesSet[0]) {
                    // 開始文字列があった場合
                    hitChecker = checker;
                    startIndex = idx;
                    if (['py', 'pyc'].includes(ext) && hitChecker.iKwType == 1 && hitChecker.iKwTypeSub < 2) {
                        // pythonの場合はブロックコメントかブロック文字列かを判定する
                        // ブロックコメントの場合は、開始文字列の前に改行があるかどうかを判定する。
                        let isBlockComment = true;
                        for (let i = 0; i < idx; i++) {
                            const ch = baseString.substring(idx - i - 1, idx - i);
                            if ([' ', '\t'].includes(ch)) {
                            } else if (['\r', '\n'].includes(ch)) {
                                break;
                            } else {
                                // 改行以外の文字があったらブロックコメントではない。
                                isBlockComment = false;
                            }
                        }
                        if (isBlockComment) {
                        } else {
                            // ブロック文字列の場合は、iKwTypeを「0:文字列リテラル」にする。
                            hitChecker = JSON.parse(JSON.stringify(checker)) as Checker;
                            hitChecker.iKwType = 0;
                        }
                    } else {
                        // python以外の場合は、iKwTypeを0にする。
                    }
                    idx = idx + hitChecker.bytesSet[1].length - 1;
                    break;
                } else {
                }
            }

            if (hitChecker) {
            } else {
                stringList.push({ promise: Promise.resolve(baseString[idx]), checker: null, cached: false });
            }
        }
    }

    return Promise.all(stringList.map((obj) => obj.promise))
        .then(results => {
            return results.map((result, index) => {
                const checker = stringList[index].checker;
                if (checker) {
                    // 開始文字列と終了文字列が正しくセットされていないことがあるので補正する。
                    // 方針：終了文字列で分割して、分割された文字列それぞれで開始文字列の有無を判定して、無ければ付け足していき、最後に結合する。
                    result = result.split(checker.bytesSet[1]).map((str, i) => {
                        if (str.length > 0) {
                            // 開始文字列で始まるかどうかを判定する。
                            if (str.startsWith(checker.bytesSet[0])) {
                                // 先頭に開始文字列がある場合は、何もしない。
                            } else {
                                // 先頭に開始文字列がない場合は、開始文字列を先頭に付け足す。
                                str = checker.bytesSet[0] + str;
                            }
                            // 終了文字列はsplitで消えてしまっているので必ず付け足す。
                            str = str + checker.bytesSet[1];
                        } else { }
                        return str;
                    }).join('');
                    return result;
                } else {
                    return result;
                }
            }).join('');
        });
}

type Checker = {
    bytesSet: string[];
    iKwType: number;
    iKwTypeSub: number;
};

/**
 * 開始文字列と終了文字列のセットを結合してソートする。
 * ※長いキーワードを先にヒットさせる必要があるため。
 * @param checker 
 * @returns 
 */
function checkerSorter(checker: string[][][]): Checker[] {
    const checkers: Checker[] = checker.flatMap((group, i) => group.map((subgroup, j) => ({
        bytesSet: subgroup,
        iKwType: i,
        iKwTypeSub: j,
    })));

    checkers.sort((a, b) => {
        const delta = b.bytesSet[0].localeCompare(a.bytesSet[0]);
        return delta === 0 ? b.bytesSet[0].length - a.bytesSet[0].length : delta;
    });

    return checkers;
}

// 指定されたディレクトリ内のすべてのファイルを処理する関数
function getDeepList(dir: string, list: string[] = []): string[] {
    const stats = fs.statSync(dir);
    if (stats.isFile()) {
        // エントリがファイルの場合は処理（ここでは単にファイル名を出力）
        list.push(dir);
        return list;
    } else {
        // ディレクトリ内のすべてのファイル/ディレクトリ名を読み取る
        const entries = fs.readdirSync(dir);

        for (const entry of entries) {
            // フルパスを取得
            const fullPath = path.join(dir, entry);
            // エントリがディレクトリの場合は再帰的に処理
            getDeepList(fullPath, list);
        }
    }
    return list;
}

/**
 *  バッチ処理のメイン関数
 * @param targetDirectory 翻訳対象のディレクトリ
 * @param targetLanguage  翻訳先の言語
 * @param outputDir       翻訳結果の出力先ディレクトリ
 * @param specifyProgrammingLanguage 拡張子による自動判別を使わずに、変換対象のプログラミング言語の拡張子を指定する
 * @param forceCopy       対応していない拡張子の場合に、ファイルをコピーするかどうか。trueの場合はコピーする。
 */
export function main(
    targetLanguage: string,
    targetDirectory: string | string[] = './src/',
    outputDir: string = './translated',
    specifyProgrammingLanguage: string = 'java',
    forceCopy: boolean = false,
) {
    // 環境変数のチェック
    if (!process.env['OPENAI_API_KEY']) {
        console.error('Please set OPENAI_API_KEY environment variable.');
        return;
    }

    // 配列型に統一する
    if (Array.isArray(targetDirectory)) { } else { targetDirectory = [targetDirectory]; }
    console.log(`Translate all comments in the source code under the ${JSON.stringify(targetDirectory)} directory into ${targetLanguage} and output them to the "${outputDir}" directory`);
    console.log(`${new Date().toLocaleString()} start`);

    // キャッシュファイルのパス
    const cacheFilePath = 'translated-cache/translateMap.json';
    // キャッシュ用のディレクトリを作成する。
    fs.mkdirSync('translated-cache', { recursive: true });
    // キャッシュを読み込む。
    let _translateMap: { [key: string]: string } = {};
    try {
        const translateMapString = fs.readFileSync(cacheFilePath, 'utf8');
        _translateMap = JSON.parse(translateMapString);
    } catch (e) {
        _translateMap = {};
    }
    // キャッシュをグローバル変数にセットする。
    Object.assign(translateMap, _translateMap);

    // 1秒ごとにキャッシュを保存する。
    const cacheSaveInterval = setInterval(() => {
        fs.writeFileSync(cacheFilePath, JSON.stringify(translateMap, null, 2));
        console.log(`${new Date().toLocaleString()} saved cache`);
    }, 1000);

    // 5秒ごとに待機中のトランザクション数を表示する。ついでにキャッシュを保存する。
    const logWatchInterval = setInterval(() => {
        console.log(`${new Date().toLocaleString()} waiting: ${counter} comments`);
    }, 5000);

    //　翻訳処理を実行する。
    const all = targetDirectory.map(dir => getDeepList(dir)).flat().map(file => {
        const outputFileName = path.join(outputDir, file.replace(/^[.\\\/]*/g, ''));
        return analyzeSourceFile(file, targetLanguage, outputFileName, specifyProgrammingLanguage, forceCopy);
    })

    // 翻訳処理が終わったらキャッシュを保存する。
    Promise.all(all).then(() => {
        console.log(`${new Date().toLocaleString()} Finished`);
        fs.writeFileSync(cacheFilePath, JSON.stringify(translateMap, null, 2));
        clearInterval(logWatchInterval);
        clearInterval(cacheSaveInterval);
    });
}
