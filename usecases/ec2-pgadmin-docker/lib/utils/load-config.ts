import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface IYamlProps  {
    PJName: string,                         // プロジェクト名
    EnvName: string,                        // 環境識別子
    VPCId: string,                    // VPCID
    PgAdminLoginId: string,          // pgAdmin ログインID（メールアドレス形式）
    PgAdminLoginPassword:string,    // パスワード
    PgAdminEC2startSchedule: string  // cron式で記述
    PgAdminEC2stopSchedule: string  // cron式で記述
};


/**
 * 指定したパスにあるyamlファイルから変数を取り出すメソッド
 * 
 * @param filename - 相対パスでの指定が可能
 * @returns IYamlProps
 */
export function loadConfig (filename: string):IYamlProps {
        const yamlPath = path.resolve(filename);
        const yamlProps = yaml.load(fs.readFileSync(yamlPath, 'utf-8')) as IYamlProps;
        return yamlProps;
}