import { AssetVisibility, updateAssets } from "@immich/sdk";
import { loadUsersConfig } from "../config.js";

const usersConfigPromise = loadUsersConfig();

export async function getOwnerApiKey(asset: {ownerId: string}): Promise<string> {
    const userConfig = (await usersConfigPromise).find(it => it.userId === asset.ownerId);
    if (userConfig) {
        return userConfig.apiKey;
    } else {
        throw new Error(`Missing configuration for user id: ${asset.ownerId}`);
    }
}

export async function archiveAsset(apiKey: string, asset: {id: string}) {
    await archiveAssets(apiKey, [asset]);
}

export async function archiveAssets(apiKey: string, assets: {id: string}[]) {
    await updateAssets(
        {assetBulkUpdateDto: {ids: assets.map(asset => asset.id), visibility: AssetVisibility.Archive}},
        {headers: {'x-api-key': apiKey}}
    );
}
