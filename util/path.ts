import { AssetResponseDto } from "@immich/sdk";

/**
 * * Given a filename, returns its basename without the extension.
 * * Given a file path, returns the full path ending with the file's basename without the extension.
 */
export function stripExtension(filePath: string): string {
    // Note: not using `node:path` since its behavior is not platform invariant.
    const lastPathSeparatorIndex = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
    const extensionDotIndex = filePath.lastIndexOf(".");
    if (extensionDotIndex === -1 || extensionDotIndex < lastPathSeparatorIndex) {
        return filePath;
    } else {
        return filePath.substring(0, extensionDotIndex);
    }
}

export function getFileDirPath(asset: AssetResponseDto): string {
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

export function inferRawImageFileBasename(developedImageFileName: string): string {
    const candidateSeparatorIndices = [" ", "_", "-"]
        .map(separator => developedImageFileName.indexOf(separator))
        .filter(it => it !== -1);

    if (candidateSeparatorIndices.length === 0) {
        return stripExtension(developedImageFileName);
    } else {
        return developedImageFileName.substring(0, Math.min(...candidateSeparatorIndices));
    }
}
