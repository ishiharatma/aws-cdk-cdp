import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
export interface IYamlProps {
    PJName: string,
    EnvName: string,
    Description: string,
    MyVPC: VPCConfig,
};
export interface VPCConfig {
    CIDR: string,
    MaxAzs: number,
    Natgateways: number,
    IsNatInstance?: boolean, // for non-production default: false
    NatInstanceType?: string, // default: t3a.micro
    PublicSubnetMask?: string,
    PrivateSubnetMask?: string,
    IsolatedSubnetMask?: string,
}

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