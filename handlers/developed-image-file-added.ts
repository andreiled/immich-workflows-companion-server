import { AssetResponseDto, searchAssets } from "@immich/sdk";
import { archiveAssets, getOwnerApiKey } from "../util/immich-sdk.js";
import { getFileDirPath, stripExtension  } from "../util/path.js";

export async function onNewDevelopedImageFile(developedImageAsset: AssetResponseDto) {
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

function inferRawImageFileBasename(developedImageFileName: string): string {
    const nameSeparatorIndex = Math.max(...[" ", "_", "-"].map(separator => developedImageFileName.indexOf(separator)));
    if (nameSeparatorIndex === -1) {
        return stripExtension(developedImageFileName);
    } else {
        return developedImageFileName.substring(0, nameSeparatorIndex);
    }
}
