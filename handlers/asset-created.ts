import { AssetResponseDto, AssetVisibility, searchAssets, updateAssets } from "@immich/sdk";
import { loadUsersConfig } from "../config.js";

const usersConfigPromise = loadUsersConfig();

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
    const apiKey = await getOwnerApiKey(developedImageAsset);

    const rawImageAssets = await findOriginalRawImageAssets(developedImageAsset);
    // TODO: if any if the found assets is a part of a series, archive the whole series of RAW files.

    if (rawImageAssets.length === 0) {
        console.log("No raw image files found for '%s'; do nothing.", developedImageAsset.originalPath);
    } else {
        console.log(
            "Archiving %d raw image file asset(s) related to the developed image file '%s':",
            rawImageAssets.length, developedImageAsset.originalPath,
            rawImageAssets.map(asset => `'${asset.originalPath}'`).join(', '), '.'
        );
        await archiveAssets(apiKey, rawImageAssets.map(asset => asset.id));
    }
}

async function onNewRawImageFile(rawImageAsset: AssetResponseDto) {
    const apiKey = await getOwnerApiKey(rawImageAsset);
    console.log("New raw image file detected: '%s'; looking for associated developed image files...", rawImageAsset.originalPath);

    const assets = await findDevelopedImageAssets(rawImageAsset);

    if (assets.length === 0) {
        console.log("Raw image file '%s' has not been developed yet; do nothing.", rawImageAsset.originalPath);
    } else {
        console.log("Found %d developed image asset(s) for '%s'; archiving the latter...", assets.length, rawImageAsset.originalPath);
        await archiveAsset(apiKey, rawImageAsset.id);
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

function getFileDirPath(asset: AssetResponseDto): string {
    const lastPathSeparatorIndex = Math.max(asset.originalPath.lastIndexOf("/"), asset.originalPath.lastIndexOf("\\"));
    if (lastPathSeparatorIndex === -1) {
        throw new Error(`Invalid data: original file path must include at least one path separator: '${asset.originalPath}', asset id: ${asset.id}.`);
    } else {
        const fileName = asset.originalPath.substring(lastPathSeparatorIndex + 1);
        if (fileName !== asset.originalFileName) {
            throw new Error(`Invalid data: original file path's basename must match the original file name: '${asset.originalPath}' vs '${asset.originalFileName}', asset id: ${asset.id}.`);
        }

        return asset.originalPath.substring(0, lastPathSeparatorIndex);
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

async function getOwnerApiKey(asset: {ownerId: string}): Promise<string> {
    const userConfig = (await usersConfigPromise).find(it => it.userId === asset.ownerId);
    if (userConfig) {
        return userConfig.apiKey;
    } else {
        throw new Error(`Missing configuration for user id: ${asset.ownerId}`);
    }
}

async function archiveAsset(apiKey: string, assetId: string) {
    await archiveAssets(apiKey, [assetId]);
}

async function archiveAssets(apiKey: string,assetIds: string[]) {
    await updateAssets(
        {assetBulkUpdateDto: {ids: assetIds, visibility: AssetVisibility.Archive}},
        {headers: {'x-api-key': apiKey}}
    );
}

async function findOriginalRawImageAssets(developedImageAsset: AssetResponseDto): Promise<AssetResponseDto[]> {
    const apiKey = await getOwnerApiKey(developedImageAsset);

    const rawImageFileBasename = inferRawImageFileBasename(developedImageAsset.originalFileName);
    const filter = {
        or: [".arw", ".cr2", ".nef", ".ARW", ".CR2", ".NEF"].map(extension => {
            return {originalFileName: {eq: `${rawImageFileBasename}${extension}`}};
        })
    };
    console.debug("findOriginalRawImageAssets: filter: %o", filter);
    const candidates = (await searchAssets({metadataSearchDto: {filter}}, {headers: {'x-api-key': apiKey}})).assets;
    console.debug("findOriginalRawImageAssets: found assets: %o", candidates);

    if (!!candidates.nextCursor) {
        throw new Error(`Found too many raw image files for ${developedImageAsset.originalPath} (first page has ${candidates.items.length} assets and there's at least one more page). This is not expected and could indicate a bug.`);
    }

    return candidates.items.filter(candidate => {
        if (candidate.id === developedImageAsset.id) {
            return false;
        }

        const developedFileDir = getFileDirPath(developedImageAsset);
        const candidateFileDir = getFileDirPath(candidate);

        // Check that the developed image file and the presumed original raw image file are stored within the same directory subtree.
        // This is a safety net against accidentally linking together files that came from different cameras using the same naming pattern.
        return developedFileDir === candidateFileDir
            || candidateFileDir.startsWith(developedFileDir + "/")
            || developedFileDir.startsWith(candidateFileDir + "/");
    });
}

async function findDevelopedImageAssets(rawImageAsset: AssetResponseDto): Promise<AssetResponseDto[]> {
    const apiKey = await getOwnerApiKey(rawImageAsset);

    const filter = {originalFileName: {startsWith: stripExtension(rawImageAsset.originalFileName)}};
    console.debug("findDevelopedImageAssets: filter: %o", filter);

    const candidates = (await searchAssets({metadataSearchDto: {filter}}, {headers: {'x-api-key': apiKey}})).assets;
    console.debug("findDevelopedImageAssets: found assets: %o", candidates);

    if (!!candidates.nextCursor) {
        throw new Error(`Found too many developed image files for ${rawImageAsset.originalPath} (first page has ${candidates.items.length} assets and there's at least one more page). This is not expected and could indicate a bug.`);
    }

    return candidates.items.filter(candidate => {
       if (candidate.id === rawImageAsset.id) {
            return false;
        }

        const rawFileDir = getFileDirPath(rawImageAsset);
        const candidateFileDir = getFileDirPath(candidate);

        // Check that the raw image file and the presumed developed image file are stored within the same directory subtree.
        // This is a safety net against accidentally linking together files that came from different cameras using the same naming pattern.
        return rawFileDir === candidateFileDir
            || candidateFileDir.startsWith(rawFileDir + "/")
            || rawFileDir.startsWith(candidateFileDir + "/");
    });
}
