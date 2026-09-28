import fs from 'node:fs/promises';

export type UserConfig = {
    userId: string;
    apiKey: string;
};

export async function loadUsersConfig(): Promise<UserConfig[]> {
    return JSON.parse(await fs.readFile("/workflows_companion_users", { encoding: 'utf8' }));
}
