import { AssetResponseDto } from "@immich/sdk";
import { RAW_FILE_EXTENTIONS_LC_DOTTED } from "../constants.js";
import { onNewDevelopedImageFile } from "./developed-image-file-added.js";
import { onNewRawImageFile } from "./raw-image-file-added.js";

export async function onAssetCreated(asset: AssetResponseDto) {
    const originalFileName = asset.originalFileName;
    if (isDevelopedImageFile(originalFileName)) {
        await onNewDevelopedImageFile(asset);
    } else if (isRawImageFile(originalFileName)) {
        await onNewRawImageFile(asset);
    }
}

function isDevelopedImageFile(fileName: string): boolean {
    const lowerCaseFileName = fileName.toLowerCase();
    return lowerCaseFileName.endsWith(".jpg") || lowerCaseFileName.endsWith(".jpeg");
}

function isRawImageFile(fileName: string): boolean {
    const lowerCaseFileName = fileName.toLowerCase();

    return !!RAW_FILE_EXTENTIONS_LC_DOTTED.find(it => lowerCaseFileName.endsWith(it));
}
