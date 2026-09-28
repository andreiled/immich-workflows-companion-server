import { AssetResponseDto, AssetVisibility, searchAssets, updateAssets } from "@immich/sdk";

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

    return lowerCaseFileName.endsWith(".arw")
        || lowerCaseFileName.endsWith(".cr2")
        || lowerCaseFileName.endsWith(".nef");
}

async function onNewDevelopedImageFile(developedImageAsset: AssetResponseDto) {
    console.log("New developed image file detected: %s; looking for the original raw file...", developedImageAsset.originalPath);

    const rawImageBasename = inferRawImageFileBasename(developedImageAsset.originalFileName);
    const filter = {
        or: [".arw", ".cr2", ".nef", ".ARW", ".CR2", ".NEF"].map(extension => {
            return {originalFileName: {eq: `${rawImageBasename}${extension}`}};
        })
    };
    const rawImageAssets = (await searchAssets({metadataSearchDto: {filter}})).assets;

    if (rawImageAssets.count === 0) {
        console.log("No raw image file found for %s; do nothing", developedImageAsset.originalPath);
    } else if (!!rawImageAssets.nextCursor) {
        console.warn("Too many raw image files found for %s; do nothing", developedImageAsset.originalPath);
    } else {
        await archiveAssets(rawImageAssets.items.map(asset => asset.id));
    }
}

async function onNewRawImageFile(rawImageAsset: AssetResponseDto) {
    console.log("New raw image file detected: '%s'; looking for associated developed image files...", rawImageAsset.originalPath);

    const filter = {originalPath: {startsWith: stripExtension(rawImageAsset.originalPath)}};
    const assets = (await searchAssets({metadataSearchDto: {filter}})).assets;

    if (assets.count === 0 || (assets.count === 1 && assets.items[0].id === rawImageAsset.id)) {
        console.log("%s has not been developed yet; do nothing", rawImageAsset.originalPath);
    } else {
        console.log("%s has been developed; archiving it...", rawImageAsset.originalPath);
        await archiveAsset(rawImageAsset.id);
    }
}

/**
 * * Given a filename, returns its basename without the extension.
 * * Given a file path, returns the full path ending with the file's basename without the extension.
 */
function stripExtension(filePath: string): string {
    // Note: not using `node:path` since its behavior is not platform invariant.
    const lastPathSeparatorIndex = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
    const extensionDotIndex = filePath.lastIndexOf(".");
    if (extensionDotIndex === -1 || extensionDotIndex < lastPathSeparatorIndex) {
        return filePath;
    } else {
        return filePath.substring(0, extensionDotIndex);
    }
}

function inferRawImageFileBasename(developedImageFileName: string): string {
    const nameSeparatorIndex = Math.max(...[" ", "_", "-"].map(separator => developedImageFileName.indexOf(separator)));
    if (nameSeparatorIndex === -1) {
        return stripExtension(developedImageFileName);
    } else {
        return developedImageFileName.substring(0, nameSeparatorIndex);
    }
}

async function archiveAsset(assetId: string) {
    await archiveAssets([assetId]);
}

async function archiveAssets(assetIds: string[]) {
    await updateAssets({assetBulkUpdateDto: {ids: assetIds, visibility: AssetVisibility.Archive}});
}
