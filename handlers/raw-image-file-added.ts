import { AssetResponseDto, searchAssets } from "@immich/sdk";
import { archiveAsset, getOwnerApiKey } from "../util/immich-sdk.js";
import { getFileDirPath, stripExtension  } from "../util/path.js";

export async function onNewRawImageFile(rawImageAsset: AssetResponseDto) {
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
