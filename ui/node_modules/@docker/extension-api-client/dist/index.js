export function createDockerDesktopClient() {
    const ddClientFromWindowObject = window
        ?.ddClient;
    if (!ddClientFromWindowObject) {
        throw new Error('Are you using this extension in a browser? Extensions can only be used in Docker Desktop' +
            'If you are using Docker Desktop, please make sure you are using the latest version.');
    }
    return ddClientFromWindowObject;
}
