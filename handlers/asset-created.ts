import { AssetResponseDto, getAssetDuplicates, init, deleteAssets } from "@immich/sdk";

export async function onAssetCreated(asset: AssetResponseDto) {
    console.log("New asset detected: %o", asset)
}
