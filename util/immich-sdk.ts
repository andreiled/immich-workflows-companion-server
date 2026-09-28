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

export async function archiveAsset(apiKey: string, assetId: string) {
    await archiveAssets(apiKey, [assetId]);
}

export async function archiveAssets(apiKey: string,assetIds: string[]) {
    await updateAssets(
        {assetBulkUpdateDto: {ids: assetIds, visibility: AssetVisibility.Archive}},
        {headers: {'x-api-key': apiKey}}
    );
}
