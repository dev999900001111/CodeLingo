import OpenAI from 'openai';
import { APIPromise, RequestOptions } from 'openai/core';
import { ChatCompletion } from 'openai/resources';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as fs from 'fs';
import * as path from 'path';

const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

// 言語ごとの文字、文字列括弧とコメントの開始文字列と終了文字列のセット
const quoteSet: { [key: string]: string[][][] } = {
    java: [
        [['"', '"'], ["'", "'"]],
        [['/*', '*/'], ['//', '\n']],
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
quoteSet['h'] = quoteSet['java'];
quoteSet['hpp'] = quoteSet['java'];
quoteSet['cs'] = quoteSet['java'];
quoteSet['scala'] = quoteSet['java'];
quoteSet['scss'] = quoteSet['java'];
quoteSet['sass'] = quoteSet['java'];
quoteSet['less'] = quoteSet['java'];
quoteSet['go'] = quoteSet['java'];
quoteSet['swift'] = quoteSet['java']; // ネストができないので、コメントのネストがある場合はエラーになる。
quoteSet['kt'] = quoteSet['java'];
quoteSet['kts'] = quoteSet['java'];
quoteSet['ts'] = quoteSet['js'];
quoteSet['tsx'] = quoteSet['js'];
quoteSet['jsx'] = quoteSet['js'];
quoteSet['htm'] = quoteSet['html'];
quoteSet['pyc'] = quoteSet['py'];
quoteSet['cl'] = quoteSet['lisp'];
quoteSet['lsp'] = quoteSet['lisp'];
quoteSet['plm'] = quoteSet['pl'];

async function analyzeSourceFile(fileName: string, language: string, outputFileName?: string): Promise<void> {
    if (!process.env['OPENAI_API_KEY']) {
        console.error('Please set OPENAI_API_KEY environment variable.');
        return;
    }

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

    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (!quoteSet[ext]) {
        if (outputFileName) {
            const buffer = await fs.promises.readFile(fileName);
            await fs.promises.writeFile(outputFileName, buffer);
            console.log(`Not supported file extension: ${ext} so Copied ${fileName} to ${outputFileName}`);
        } else {
            console.error(`Not supported file extension: ${ext}`);
        }
        return;
    }

    const fileBuffer = await fs.promises.readFile(fileName, 'utf8');
    analyzeSourceCode(fileBuffer, ext, language)
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
    const stringList: { promise: Promise<string>, checker: Checker | null }[] = [];
    for (let idx = 0; idx < baseString.length; idx++) {
        if (hitChecker) {
            // すでにヒットしている場合
            // 終了文字列があるかどうかを判定する。
            const end = baseString.substring(idx, idx + hitChecker.bytesSet[1].length);
            if (end === hitChecker.bytesSet[1]) {
                if (hitChecker.iKwType === 1) {
                    const translateTarget = baseString.substring(startIndex, idx + hitChecker.bytesSet[1].length);
                    // console.log(`Translate: ${translateTarget}`);
                    // コメントの場合は翻訳する。
                    stringList.push({
                        promise: (openai.chat.completions.create({
                            model: 'gpt-3.5-turbo',
                            temperature: 0.0,
                            messages: [
                                { role: 'system', content: `Translate the comments into ${targetLanguage}. Please return the comments that are originally in ${targetLanguage} as is. Be careful not to change the presence of newline characters.` },
                                { role: 'user', content: translateTarget },
                            ],
                        }, options) as APIPromise<ChatCompletion>)
                            .withResponse()
                            .then(response => response.data.choices[0].message.content || ''),
                        checker: hitChecker
                    });
                } else {
                    // リテラルの場合はそのまま返す。
                    stringList.push({ promise: Promise.resolve(baseString.substring(startIndex, idx + hitChecker.bytesSet[1].length)), checker: null });
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
                    if (['py', 'pyc'].includes(ext)) {
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
                            // ブロック文字列の場合は、iKwTypeを0にする。
                            hitChecker = JSON.parse(JSON.stringify(checker)) as Checker;
                            hitChecker.iKwType = 0;
                        }
                    }
                    idx = idx + hitChecker.bytesSet[1].length - 1;
                    break;
                } else {
                }
            }

            if (hitChecker) {
            } else {
                stringList.push({ promise: Promise.resolve(baseString[idx]), checker: null });
            }
        }
    }

    return Promise.all(stringList.map((obj) => obj.promise))
        .then(results => {
            return results.map((result, index) => {
                const checker = stringList[index].checker;
                if (checker) {
                    // 開始文字列と終了文字列が消えていたら付け足す。
                    if (!result.startsWith(checker.bytesSet[0])) { result = checker.bytesSet[0] + result; }
                    if (!result.endsWith(checker.bytesSet[1])) { result = result + checker.bytesSet[1]; }
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
        const delta = a.bytesSet[0].localeCompare(b.bytesSet[0]);
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
 */
export function main(targetDirectory: string | string[] = '', targetLanguage: string = 'Japanese', outputDir: string = './translated') {
    // 配列型に統一する
    if (Array.isArray(targetDirectory)) { } else { targetDirectory = [targetDirectory]; }
    console.log(`Translate all comments in the source code under the ${JSON.stringify(targetDirectory)} directory into ${targetLanguage} and output them to the "${outputDir}" directory`);
    targetDirectory.map(dir => getDeepList(dir)).flat().forEach(file => {
        const outputFileName = path.join(outputDir, file.replace(/^[.\\\/]*/g, ''));
        analyzeSourceFile(file, targetLanguage, outputFileName);
    });
}
